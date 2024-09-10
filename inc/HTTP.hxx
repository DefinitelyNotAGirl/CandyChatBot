#pragma once
#include "string.hxx"
#include "map.hxx"
#include "buffer.hxx"

namespace THL {
	namespace https {
		class Exception {
		public:
		};
		class ConnectionException : Exception {
		public:
		};
		class SocketCreationException : Exception {
		public:
		};
		class HostResolveException : Exception {
		public:
			string hostname;
			HostResolveException(string hostname) : hostname(hostname) {}
		};
		class response {
		public:
			string url;
			map<string,string> headers;
			buffer body;
		};
		class request {
		public:
			string url;
			map<string,string> headers;
			buffer body;
			string method;
			u16 port = 80;
			response send();
		};
	}
};

#ifdef THL_IMPLEMENT
#include <iostream>
#include <sys/socket.h>
#include <unistd.h>
#include <cstring>
#include <netdb.h>
#include <openssl/ssl.h>
#include <openssl/err.h>

using namespace THL;

static int create_socket(const char* host, const char* port) {
    struct addrinfo hints{}, *res;
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;

    if (getaddrinfo(host, port, &hints, &res) != 0) {
        std::cerr << "Error: getaddrinfo failed.\n";
        return -1;
    }

    int sockfd = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (sockfd < 0) {
        std::cerr << "Error: Unable to create socket.\n";
        freeaddrinfo(res);
        return -1;
    }

    if (connect(sockfd, res->ai_addr, res->ai_addrlen) != 0) {
        std::cerr << "Error: Unable to connect to host.\n";
        close(sockfd);
        freeaddrinfo(res);
        return -1;
    }

    freeaddrinfo(res);
    return sockfd;
}

static void init_openssl() {
    SSL_load_error_strings();
    OpenSSL_add_ssl_algorithms();
}

static void cleanup_openssl() {
    EVP_cleanup();
}

static SSL_CTX* create_ssl_context() {
    const SSL_METHOD* method = SSLv23_client_method();
    SSL_CTX* ctx = SSL_CTX_new(method);
    if (!ctx) {
        std::cerr << "Error: Unable to create SSL context.\n";
        ERR_print_errors_fp(stderr);
        exit(EXIT_FAILURE);
    }
    return ctx;
}


//.
//.	https request send
//.
https::response https::request::send() {
	string host = this->url.substr(0,this->url.find_first_of('/'));
	string path = this->url.substr(this->url.find_first_of('/'));
	struct addrinfo hints{}, *res;
	hints.ai_family = AF_INET;
	hints.ai_socktype = SOCK_STREAM;
	// Get address info
	if (getaddrinfo(host.c_str(), std::to_string(this->port).c_str(), &hints, &res) != 0) {
	    std::cerr << "Error resolving host\n";
		throw HostResolveException(string(host));
	}
	// Create socket
	int sockfd = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
	if (sockfd < 0) {
	    std::cerr << "Error creating socket\n";
		throw SocketCreationException();
	}
	// Connect to server
	if (connect(sockfd, res->ai_addr, res->ai_addrlen) < 0) {
	    std::cerr << "Error connecting to server\n";
	    close(sockfd);
		throw ConnectionException();
	}
	// Free address info after use
	freeaddrinfo(res);
	// Send HTTP GET request
	string request = this->method+" " + path + " HTTP/1.1\r\n";
	request += "Host: " + host + "\r\n";
	request += "Connection: close\r\n\r\n";
	::send(sockfd, request.c_str(), request.size(), 0);
	// Read the response
	char buffer[4096];
	ssize_t bytes_received;
	while ((bytes_received = read(sockfd, buffer, sizeof(buffer))) > 0) {
	    std::cout.write(buffer, bytes_received);
	}
	// Close socket
	close(sockfd);
	return response();
}
#endif
