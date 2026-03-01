# Use the official PHP image with Apache
FROM php:8.2-apache

# Enable Apache modules (like mod_rewrite if needed)
RUN a2enmod rewrite

# Install the MySQL extensions so weather.php can talk to the database
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Copy your entire project into the Apache web root
COPY . /var/www/html/

# Expose port 80 for the web server
EXPOSE 80