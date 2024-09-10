#pragma once

#include <string>
#include <iostream>
#include <vector>

#if defined(platform_linux)
	struct TraceInfo {
	    std::string file;
	    int line;
	    std::string function;
	};
	#include <backtrace.h>
	#include <execinfo.h>
	#include <unistd.h>
	#include <cxxabi.h> // For __cxa_demangle
	static void error_callback(void *data, const char *msg, int errnum) {
	    std::cerr << "Error: " << msg << " (errnum " << errnum << ")\n";
	}
	
	static void syminfo_callback(void *data, uintptr_t pc, const char *symname, uintptr_t symval, uintptr_t symsize) {
	    TraceInfo *info = reinterpret_cast<TraceInfo*>(data);
	    if (symname) {
	        int status;
	        char *demangled = abi::__cxa_demangle(symname, nullptr, nullptr, &status);
	        if (status == 0) {
	            info->function = demangled;
	            free(demangled);
	        } else {
	            // Demangling failed, use the original symbol name
	            info->function = symname;
	        }
	    }
	}
	
	static int full_callback(void *data, uintptr_t pc, const char *filename, int lineno, const char *function) {
	    auto trace_info = reinterpret_cast<std::vector<TraceInfo>*>(data);
	    TraceInfo info;
	    if (filename) {
	        info.file = filename;
	        info.line = lineno;
	    }
	    if (function) {
	        int status;
	        char *demangled = abi::__cxa_demangle(function, nullptr, nullptr, &status);
	        if (status == 0) {
	            info.function = demangled;
	            free(demangled);
	        } else {
	            // Demangling failed, use the original function name
	            info.function = function;
	        }
	    }
	    trace_info->push_back(info);
	    return 0;
	}
	
	static std::string get_source_info(void *addr) {
	    backtrace_state *state = backtrace_create_state(nullptr, 1, error_callback, nullptr);
	    if (!state) {
	        return "Failed to create backtrace state.";
	    }
	
	    std::vector<TraceInfo> trace_info;
	    backtrace_pcinfo(state, reinterpret_cast<uintptr_t>(addr), full_callback, error_callback, &trace_info);
	    if (trace_info.empty()) {
	        return "No source info available.";
	    }
	
	    const TraceInfo &info = trace_info.front();
	    std::string result;
	    if (!info.file.empty()) {
	        result += info.file + ":" + std::to_string(info.line);
	    }
	    if (!info.function.empty()) {
	        result += " in " + info.function;
	    }
	    return result;
	}
	
	inline void printStacktrace(uint64_t len)
	{
		void** array = (void**)calloc(len,8);
		size_t size = backtrace(array, len);
		std::cerr << "stack trace: ";
		for(uint64_t I = 1;I<size;I++)
		{
			std::string info = get_source_info(array[I]);
			if(!info.empty())std::cerr << "\n" << info;
		}
		std::cerr << std::endl;
	}
#elif defined(platform_apple)
#include <execinfo.h>
#include <unistd.h>
#include <cxxabi.h> // For __cxa_demangle
#include <dlfcn.h>  // For dladdr
#include <cstdio>
#include <cstdlib>
#include <string>
#include <iostream>
#include <sstream>
#include <vector>

static std::string demangle(const char* mangledName) {
    int status;
    char* demangled = abi::__cxa_demangle(mangledName, nullptr, nullptr, &status);
    std::string result = (status == 0) ? demangled : mangledName;
    free(demangled);
    return result;
}

static std::string run_atos(const char* execPath, uintptr_t addr, uintptr_t baseAddr) {
    std::ostringstream cmd;
    cmd << "atos -o " << execPath << " -l " << std::hex << baseAddr << " " << std::hex << addr;
    std::array<char, 256> buffer;
    std::string result;
    std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(cmd.str().c_str(), "r"), pclose);
    if (!pipe) {
        return "atos command failed";
    }
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
        result += buffer.data();
    }
    return result;
}

static std::string get_source_info(void* addr, const char* execPath) {
    Dl_info info;
    if (dladdr(addr, &info) && info.dli_sname) {
        std::string function = demangle(info.dli_sname);
        std::string file = ((info.dli_fname) ? info.dli_fname : "unknown");
        uintptr_t baseAddr = reinterpret_cast<uintptr_t>(info.dli_fbase);
        uintptr_t addrOffset = reinterpret_cast<uintptr_t>(addr);
        std::string line_info = run_atos(execPath, addrOffset, baseAddr);
        return file + " in " + function + " at " + line_info;
    }
    return "No source info available.";
}

static void printStacktrace(uint64_t len) {
    void** array = (void**)calloc(len, sizeof(void*));
    size_t size = backtrace(array, len);
    char** symbols = backtrace_symbols(array, size);

    const char* execPath = getprogname(); // Get the program name

    std::cerr << "stack trace:";
    for (size_t i = 1; i < size; ++i) {
        std::string info = get_source_info(array[i], execPath);
        if (!info.empty()) std::cerr << "\n" << info;
    }
    std::cerr << std::endl;
    free(array);
    free(symbols);
}
#else
	std::string get_source_info(void* addr);
	void printStacktrace(uint64_t len);
#endif
