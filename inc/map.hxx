#pragma once
#include <map>

template<typename key,typename value>
class map : public std::map<key,value>{
};
