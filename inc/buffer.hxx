#pragma once
#include "stdint.hxx"
#include <cstring>
#include <stdlib.h>

class buffer {
private:
	void* data;
	u64 size;
public:
	buffer(){}
	buffer(void* data,u64 size) : data(data),size(size) {}
	~buffer() {
		free(this->data);
	}

	void clear() {
		memset(this->data,0,this->size);
	}

	void push(void* data, u64 size) {
		this->data = realloc(this->data,this->size+size);
		memcpy(this->data+this->size,data,size);
		this->size += size;
	}
};
