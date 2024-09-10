#include <string>

class string : public std::string {
public:
	using std::string::basic_string;
	string(std::string str) {
		*this = str;
	}
};
