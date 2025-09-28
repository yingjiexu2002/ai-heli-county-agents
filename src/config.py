import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    CSV_FILE_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', '中国_县.csv')
    GEOJSON_FILE_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', '中国_县.geojson')
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME') or 'admin'
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or 'admin'
    
    @staticmethod
    def init_app(app):
        pass

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    
    # 在生产环境中，我们应该从环境变量读取密钥
    SECRET_KEY = os.environ.get('SECRET_KEY')

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}