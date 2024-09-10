#include <vector>
#include <string>
#include <map>
#define indent_expression "\t"
namespace html {
	class element {
	public:
		typedef std::pair<std::string,std::string> attribute;
		std::string Type = "";
		std::vector<element> children;
		std::map<std::string,std::string> attributes;
		std::string TextContent = "";

		element(std::string Type,std::map<std::string,std::string> attributes,std::string content)
			:Type(Type),attributes(attributes),TextContent(content){}
		element(std::string Type,std::map<std::string,std::string> attributes,std::vector<element> children)
			:Type(Type),attributes(attributes),children(children){}

		std::string toString(std::string indent = "") {
			std::string result;
			if(this->Type == "__skip__") {
				return result;
			}
			result += indent+"<"+this->Type;
			for(const std::pair<std::string,std::string>& attribute : attributes) {
				result += " "+attribute.first+"=\""+attribute.second+"\"";
			}
			result+=">\n";
			if(this->TextContent != "")
				result+=indent+indent_expression+this->TextContent+"\n";
			for(element& Element : this->children) {
				result += Element.toString(indent + indent_expression);
			}
			if(this->Type == "link")return result;
			if(this->Type == "meta")return result;
			if(this->Type == "img")return result;
			result += indent+"</"+this->Type+">\n";
			return result;
		}

		void save(std::string path) {
			std::string text = this->toString();
			char* data = text.data();
			FILE* f = fopen(path.c_str(),"w");
			fwrite(data,text.size(),1,f);
			fclose(f);
		}
	};
}