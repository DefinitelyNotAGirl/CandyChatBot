#pragma once
#include <map>
#include <cstdint>
#include <iostream>
#include <stack>
typedef uint64_t u64;
typedef int64_t i64;

enum class JSONObjectType {
	String,
	Integer,
	Boolean,
	Float,
	List,
	Object
};

class JSON;
typedef JSON*		JSONNoSuchChild;
typedef JSON**		JSONKeyAccessOnList;
typedef JSON***		JSONChildAccessOnSingleValue;
typedef JSON****	JSONChildAdditionOnSingleValue;
class JSON {
public:
	JSONObjectType Type = JSONObjectType::Object;
public:
	// generic
	std::string name;
	// container values
public:
	std::vector<JSON> children;
	// item values
	std::string StringValue;
	i64 IntegerValue;
	bool BooleanValue;
	double FloatValue;
public:
	JSON(){}
	JSON(std::string name,std::string value) {
		this->Type = JSONObjectType::String;
		this->StringValue = value;
		this->name = name;
	}
	JSON(std::string name,i64 value) {
		this->Type = JSONObjectType::Integer;
		this->IntegerValue = value;
		this->name = name;
	}
	JSON(std::string name,double value) {
		this->Type = JSONObjectType::Float;
		this->FloatValue = value;
		this->name = name;
	}
	JSON(std::string name,const char* value) {
		this->Type = JSONObjectType::String;
		this->StringValue = value;
		this->name = name;
	}
	JSON(std::string name,bool value) {
		this->Type = JSONObjectType::Boolean;
		this->BooleanValue = value;
		this->name = name;
	}
	JSON(std::string value) {
		this->Type = JSONObjectType::String;
		this->StringValue = value;
		this->name = "";
	}
	JSON(i64 value) {
		this->Type = JSONObjectType::Integer;
		this->IntegerValue = value;
		this->name = "";
	}
	JSON(double value) {
		this->Type = JSONObjectType::Float;
		this->FloatValue = value;
		this->name = "";
	}
	JSON(const char* value) {
		this->Type = JSONObjectType::String;
		this->StringValue = value;
		this->name = "";
	}
	JSON(bool value) {
		this->Type = JSONObjectType::Boolean;
		this->BooleanValue = value;
		this->name = "";
	}
	static JSON list(std::string name,std::vector<JSON> children) {
		JSON res;
		res.name = name;
		res.Type = JSONObjectType::List;
		res.children = children;
		return res;
	}
	static JSON list(std::vector<JSON> children) {return list("",children);}
	static JSON object(std::string name,std::vector<JSON> children) {
		JSON res;
		res.name = name;
		res.Type = JSONObjectType::Object;
		res.children = children;
		return res;
	}
	static JSON object(std::vector<JSON> children) {return object("",children);}
	JSON(void*,std::string content) {
		//std::cout << "content:\n" << content << std::endl;
		this->Type = content[0] == '{' ? JSONObjectType::Object : JSONObjectType::List;
		content = content.substr(1,content.length()-2);
		if(this->Type == JSONObjectType::Object) {
			for(u64 i = 0;i < content.length();i++) {
				if(content[i] == ',')continue;
				//std::cout << "character: " << content[i] << std::endl;
				std::string working = "";
				if(content[i] == '"') {
					i++;
					while(content[i] != '"') {
						if(content[i] == '\\') {
							if(content[i+1] == '"')i++;
						}
						working.push_back(content[i++]);
					}
				}
				i++;
				if(content[i] == ':') {
					i++;
					std::string name = working;
					working = "";
					if(content[i] == '"') {
						i++;
						while(content[i] != '"') {
							if(content[i] == '\\') {
								if(content[i+1] == '"')i++;
							}
							working.push_back(content[i++]);
						}
						JSON child;
						child.Type = JSONObjectType::String;
						child.name = name;
						child.StringValue = working;
						this->children.push_back(child);
						//std::cout << "string: \"" << name << "\":\"" << working << "\"" << std::endl;
					} else if(isdigit(content[i])) {
						while(isdigit(content[i])) {
							working.push_back(content[i++]);
						}
						if(content[i] == '.') {
							working.push_back(content[i++]);
							while(isdigit(content[i])) {
								working.push_back(content[i++]);
							}
							JSON child;
							child.Type = JSONObjectType::Float;
							child.name = name;
							child.FloatValue = strtod(working.c_str(),(char**)working.c_str()+working.length());
							this->children.push_back(child);
							//std::cout << "float: \"" << name << "\":" << child.FloatValue << std::endl;
						} else {
							JSON child;
							child.Type = JSONObjectType::Integer;
							child.name = name;
							child.IntegerValue = strtoll(working.c_str(),(char**)working.c_str()+working.length(),10);
							this->children.push_back(child);
							//std::cout << "integer: \"" << name << "\":" << child.IntegerValue << std::endl;
						}
					} else if((content.length() >= (i+4)) && ((content[i] == 't') || (content[i] == 'f'))) {
						if(content.substr(i,strlen("true")) == "true") {
							JSON child;
							child.Type = JSONObjectType::Boolean;
							child.name = name;
							child.IntegerValue = true;
							this->children.push_back(child);
						} else if(content.substr(i,strlen("false")) == "false") {
							JSON child;
							child.Type = JSONObjectType::Boolean;
							child.name = name;
							child.IntegerValue = false;
							this->children.push_back(child);
						}
					} else if((content[i] == '{') || (content[i] == '[')) {
						char openChar = content[i];
						char closeChar = content[i]+2;
						u64 len = 0;
						u64 level = 1;
						i++;
						while(level != 0) {
							if(content[i] == openChar)level++;
							else if(content[i] == closeChar)level--;
							if(content[i] == '"') {
								i++;
								len++;
								while(content[i] != '"') {
									if(content[i] == '\\') {
										if(content[i+1] == '"') {
											i++;
											len++;
										}
									}
									i++;
									len++;
								}
							}
							i++;
							len++;
						}
						//std::cout << "name: " << name << std::endl;
						JSON child(nullptr,content.substr(i-len-1,len+1));
						child.name = name;
						this->children.push_back(child);
					}
				}
			}
		} else {
			for(u64 i = 0;i < content.length();i++) {
				if(content[i] == ',')continue;
				//std::cout << "character: " << content[i] << std::endl;
				std::string working = "";
				if(content[i] == '"') {
					i++;
					while(content[i] != '"') {
						if(content[i] == '\\') {
							if(content[i+1] == '"')i++;
						}
						working.push_back(content[i++]);
					}
					JSON child;
					child.Type = JSONObjectType::String;
					child.name = "";
					child.StringValue = working;
					this->children.push_back(child);
					//std::cout << "children string: \"" << name << "\":\"" << working << "\"" << std::endl;
				} else if(isdigit(content[i])) {
					while(isdigit(content[i])) {
						working.push_back(content[i++]);
					}
					if(content[i] == '.') {
						working.push_back(content[i++]);
						while(isdigit(content[i])) {
							working.push_back(content[i++]);
						}
						JSON child;
						child.Type = JSONObjectType::Float;
						child.name = "";
						child.FloatValue = strtod(working.c_str(),(char**)working.c_str()+working.length());
						this->children.push_back(child);
						//std::cout << "float: \"" << name << "\":" << child.FloatValue << std::endl;
					} else {
						JSON child;
						child.Type = JSONObjectType::Integer;
						child.name = "";
						child.IntegerValue = strtoll(working.c_str(),(char**)working.c_str()+working.length(),10);
						this->children.push_back(child);
						//std::cout << "integer: \"" << name << "\":" << child.IntegerValue << std::endl;
					}
				} else if((content.length() >= (i+4)) && ((content[i] == 't') || (content[i] == 'f'))) {
					if(content.substr(i,strlen("true")) == "true") {
						JSON child;
						child.Type = JSONObjectType::Boolean;
						child.name = "";
						child.IntegerValue = true;
						this->children.push_back(child);
					} else if(content.substr(i,strlen("false")) == "false") {
						JSON child;
						child.Type = JSONObjectType::Boolean;
						child.name = "";
						child.IntegerValue = false;
						this->children.push_back(child);
					}
				} else if((content[i] == '{') || (content[i] == '[')) {
					char openChar = content[i];
					char closeChar = content[i]+2;
					u64 len = 0;
					u64 level = 1;
					i++;
					while(level != 0) {
						if(content[i] == openChar)level++;
						else if(content[i] == closeChar)level--;
						if(content[i] == '"') {
							i++;
							len++;
							while(content[i] != '"') {
								if(content[i] == '\\') {
									if(content[i+1] == '"') {
										i++;
										len++;
									}
								}
								i++;
								len++;
							}
						}
						i++;
						len++;
					}
					//std::cout << "name: " << name << std::endl;
					JSON child(nullptr,content.substr(i-len-1,len+1));
					child.name = name;
					this->children.push_back(child);
				}
			}
		}
	}
	void load(std::string path) {
		//.
		//. read file
		//.
		char* data = nullptr;
		long flen = 0;
		{
			FILE* f = fopen(path.c_str(),"r");
			fseek(f,0,SEEK_END);
			flen = ftell(f);
			fseek(f,0,SEEK_SET);
			data = (char*)malloc(flen);
			fread((void*)data,flen,1,f);
			fclose(f);
		}
		//.
		//. strip content
		//.
		std::string content = "";
		{
			for(u64 i = 0;i < flen;i++) {
				if(data[i] == ' ')continue;
				if(data[i] == '\t')continue;
				if(data[i] == '\n')continue;
				if(data[i] == '"') {
					content.push_back(data[i]);
					i++;
					while(data[i] != '"') {
						if(data[i] == '\\') {
							if(data[i+1] == '"')i++;
						}
						content.push_back(data[i++]);
					}
				}
				content.push_back(data[i]);
			}
		}
		//.
		//. parse
		//.
		*this = JSON(nullptr,content);
		this->name = path;
	}
	std::string toString(std::string indent) const {
		if(this->Type == JSONObjectType::Boolean) {
			return this->BooleanValue ? "true" : "false";
		}
		if(this->Type == JSONObjectType::Float) {
			return std::to_string(this->FloatValue);
		}
		if(this->Type == JSONObjectType::Integer) {
			return std::to_string(this->IntegerValue);
		}
		if(this->Type == JSONObjectType::String) {
			return "\""+this->StringValue+"\"";
		}
		if(this->Type == JSONObjectType::Object) {
			std::string out = "{\n";
			std::string childindent = indent+"\t";
			for(const JSON& child : this->children) {
				out+=childindent+"\""+child.name+"\" : "+child.toString(childindent)+",\n";
			}
			out.pop_back();
			out+="\n"+indent+"}";
			return out;
		}
		if(this->Type == JSONObjectType::List) {
			std::string out = "[\n";
			std::string childindent = indent+"\t";
			for(const JSON& child : this->children) {
				out+=childindent+child.toString(childindent)+",\n";
			}
			out.pop_back();
			out+="\n"+indent+"]";
			return out;
		}
		return "ERROR, INVALID JSON OBJECT";
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 * @throws JSONKeyAccessOnList
	 */
	JSON& operator[](std::string key) {
		if(this->Type == JSONObjectType::Object) {
			for(JSON& child : this->children) {
				if(child.name == key)
					return child;
			}
			throw (JSONNoSuchChild)nullptr;
		}
		if(this->Type == JSONObjectType::List) {
			throw (JSONKeyAccessOnList)nullptr;
		}
		throw (JSONChildAccessOnSingleValue)nullptr;
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 */
	JSON& operator[](u64 index) {
		if(this->Type == JSONObjectType::Object || this->Type == JSONObjectType::List) {
			if(index >= this->children.size()) {
				throw (JSONNoSuchChild)nullptr;
			}
			return this->children[index];
		}
		throw (JSONChildAccessOnSingleValue)nullptr;
	}
	/**
	 * @throws JSONChildAdditionOnSingleValue
	 */
	void add(JSON child) {
		if((this->Type == JSONObjectType::Object) || (this->Type == JSONObjectType::List)) {
			this->children.push_back(child);
		} else throw (JSONChildAdditionOnSingleValue)nullptr;
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 * @throws JSONKeyAccessOnList
	 * @throws JSONObjectType
	 */
	bool GetBoolean(std::string key) {
		JSON& child = this->operator[](key);
		if(child.Type != JSONObjectType::Boolean)throw (JSONObjectType)child.Type;
		return child.BooleanValue;
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 * @throws JSONKeyAccessOnList
	 * @throws JSONObjectType
	 */
	std::string GetString(std::string key) {
		JSON& child = this->operator[](key);
		if(child.Type != JSONObjectType::String)throw (JSONObjectType)child.Type;
		return child.StringValue;
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 * @throws JSONKeyAccessOnList
	 * @throws JSONObjectType
	 */
	double GetFloat(std::string key) {
		JSON& child = this->operator[](key);
		if(child.Type != JSONObjectType::Float)throw (JSONObjectType)child.Type;
		return child.FloatValue;
	}
	/**
	 * @throws JSONChildAccessOnSingleValue
	 * @throws JSONNoSuchChild
	 * @throws JSONKeyAccessOnList
	 * @throws JSONObjectType
	 */
	i64 GetInteger(std::string key) {
		JSON& child = this->operator[](key);
		if(child.Type != JSONObjectType::Integer)throw (JSONObjectType)child.Type;
		return child.IntegerValue;
	}
	void save(std::string path) {
		std::string text = this->toString("");
		char* data = text.data();
		FILE* f = fopen(path.c_str(),"w");
		fwrite(data,text.size(),1,f);
		fclose(f);
	}
};
