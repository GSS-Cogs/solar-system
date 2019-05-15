FROM mariadb:10
MAINTAINER Alex Tucker <alex@floop.org.uk>

COPY maria-init.sql /docker-entrypoint-initdb.d/00-init.sql
COPY utf8.cnf /etc/mysql/conf.d/utf8.cnf
