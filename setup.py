from setuptools import setup, find_packages

setup(
    name="youtube-downloader",
    version="1.0.0",
    packages=[],
    py_modules=["main", "app"],
    install_requires=[
        "flask>=3.1.1",
        "gunicorn>=23.0.0", 
        "yt-dlp>=2025.7.21",
        "flask-sqlalchemy>=3.1.1",
        "psycopg2-binary>=2.9.10",
        "email-validator>=2.2.0"
    ],
    python_requires=">=3.8",
)