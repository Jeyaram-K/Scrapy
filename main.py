import scrapy
from scrapy.crawler import CrawlerProcess
import sys

class MovieFinderSpider(scrapy.Spider):
    name = "moviefinder"
    
    def __init__(self, movie_name=None, *args, **kwargs):
        super(MovieFinderSpider, self).__init__(*args, **kwargs)
        self.movie_name = movie_name
        self.found = False

    def start_requests(self):
        if not self.movie_name:
            self.logger.error("Please provide a movie_name argument.")
            return
            
        urls = [
            'https://moviesda17.com/',
            'https://isaidub.love/'
        ]
        for url in urls:
            yield scrapy.Request(url, callback=self.parse_homepage)

    def parse_homepage(self, response):
        """Extract all category links and traverse them"""
        self.logger.info(f"Searching for '{self.movie_name}' across categories...")
        categories = response.css('div.f a::attr(href)').getall()
        for cat_url in categories:
            # We don't want external category links etc, only local to that domain
            domain = response.url.split('/')[2]
            if domain in response.urljoin(cat_url) or cat_url.startswith('/'):
                yield response.follow(cat_url, callback=self.parse_category)

    def parse_category(self, response):
        if self.found:
            return
            
        movie_links = response.css('div.f a')
        for link in movie_links:
            title = link.css('::text').get()
            if title and self.movie_name.lower() in title.lower():
                self.found = True
                self.logger.info(f"Found movie: {title}")
                next_page = link.css('::attr(href)').get()
                yield response.follow(next_page, callback=self.parse_folder_level)
                return
                
        # Handle pagination within category
        next_page = response.css('ul.pagination li a.next::attr(href)').get()
        if next_page and not self.found:
            yield response.follow(next_page, callback=self.parse_category)

    def parse_folder_level(self, response, context=None, meta=None):
        if context is None:
            context = []
        if meta is None:
            meta = {}
            
        if response.css('div.movie-info-container'):
            meta['image_url'] = response.urljoin(response.css('div.movie-info-container picture img::attr(src)').get() or '')
            meta['director'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Director:")]]/span/text()').get()
            meta['starring'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Starring:")]]/span/text()').get()
            meta['genres'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Genres:")]]/span/text()').get()
            meta['quality'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Quality:")]]/span/text()').get()
            meta['language'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Language:")]]/span/text()').get()
            meta['movie_rating'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Movie Rating:")]]/span/text()').get()
            meta['last_updated'] = response.xpath('//ul[@class="movie-info"]/li[strong[contains(text(), "Last Updated:")]]/span/text()').get()
            synopsis_texts = response.css('div.movie-synopsis::text').getall()
            meta['synopsis'] = "".join(synopsis_texts).strip()

        # Check if we are at the file download page Level (the page with "Download Server" links)
        server_links = response.css('div.download a')
        if server_links and any("Download Server" in a.css('::text').get() for a in server_links):
            # This is a download page!
            file_name = response.xpath('//div[contains(@class, "details")]/strong[contains(text(), "File Name")]/../text()').re_first(r':\s*(.*)')
            if not file_name:
                # Backup way to get file name
                file_name_div = response.css('div.details:contains("File Name")::text').get()
                if file_name_div:
                    file_name = file_name_div.split(':')[-1].strip()
                else:
                    file_name = "Unknown"

            for link in server_links:
                server_name = link.css('::text').get()
                server_url = link.css('::attr(href)').get()
                if server_url and server_name and "Watch Online" not in server_name:
                    yield response.follow(
                        server_url, 
                        callback=self.parse_redirect, 
                        cb_kwargs={
                            'context': context, 
                            'file_name': file_name,
                            'server_name': server_name,
                            'meta': meta
                        }, 
                        meta={'dont_redirect': True, 'handle_httpstatus_list': [301, 302, 303, 307, 308]},
                        dont_filter=True
                    )
            return

        # Check if we are at the resolution page Level, looking for actual download page link
        # e.g a list of <li> elements inside a <div class="left">
        file_links = response.css('div.left ul li a')
        if file_links:
            for link in file_links:
                file_name = link.css('::text').get()
                download_url = link.css('::attr(href)').get()
                if download_url:
                    yield response.follow(download_url, callback=self.parse_folder_level, cb_kwargs={'context': context, 'meta': meta})
            return
            
        # Otherwise, this is a folder directory, recurse deeper
        folders = response.css('div.f a')
        for folder in folders:
            folder_name = folder.css('::text').get()
            folder_url = folder.css('::attr(href)').get()
            if folder_url and folder_name:
                # pass down the folder history (like Quality -> Single Part -> Resolution)
                new_context = context.copy()
                new_context.append(folder_name)
                yield response.follow(folder_url, callback=self.parse_folder_level, cb_kwargs={'context': new_context, 'meta': meta})

    def parse_redirect(self, response, context, file_name, server_name, meta):
        # If we hit a redirect (301/302), the Location header is the final mp4 link!
        if response.status in (301, 302, 303, 307, 308):
            location = response.headers.get('Location')
            if location:
                location = location.decode('utf-8')
                if '.mp4' in location.lower():
                    domain = response.request.url.split('/')[2]
                    item = {
                        'movie_name': self.movie_name, 
                        'source_domain': domain,
                        'folder_path': " -> ".join(context),
                        'server': server_name,
                        'mp4_link': location
                    }
                    if meta:
                        item.update({k: v for k, v in meta.items() if v})
                    yield item
            return
            
        server_links = response.css('div.download a')
        for link in server_links:
            new_server_name = link.css('::text').get()
            server_url = link.css('::attr(href)').get()
            
            # Make sure to follow the link for the same server we started with
            if server_url and new_server_name and server_name in new_server_name:
                if server_url.endswith('.mp4'):
                    domain = response.request.url.split('/')[2]
                    item = {
                        'movie_name': self.movie_name, 
                        'source_domain': domain,
                        'folder_path': " -> ".join(context),
                        'server': server_name,
                        'mp4_link': server_url
                    }
                    if meta:
                        item.update({k: v for k, v in meta.items() if v})
                    yield item
                else:
                    yield response.follow(
                        server_url, 
                        callback=self.parse_redirect, 
                        cb_kwargs={
                            'context': context, 
                            'file_name': file_name,
                            'server_name': server_name,
                            'meta': meta
                        }, 
                        meta={'dont_redirect': True, 'handle_httpstatus_list': [301, 302, 303, 307, 308]},
                        dont_filter=True
                    )

if __name__ == "__main__":
    movie_to_search = sys.argv[1] if len(sys.argv) > 1 else "Nanban"
    
    process = CrawlerProcess(settings={
        "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "LOG_LEVEL": "DEBUG",
        "LOG_FILE": "debug.log",
        "DOWNLOAD_TIMEOUT": 15,
        "FEEDS": {
            "result.json": {"format": "json", "overwrite": True},
        },
    })
    process.crawl(MovieFinderSpider, movie_name=movie_to_search)
    process.start()
