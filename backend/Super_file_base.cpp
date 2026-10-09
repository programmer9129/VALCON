// Super_file_base.cpp : Defines the entry point for the application.
//making the user Auth and password service including the password hashing

#include "Super_file_base.h"
#include "crow.h"
#include "crow/middlewares/cors.h"
#include <string.h>
#include <algorithm>
#include <cstdlib>
#include <vector>
#include <cmath>
#include <curl/curl.h>

#include <functional>
#include <stdexcept>
#include <cctype>
#include <sstream>
#include <iomanip>
#include <unordered_map>
#include <mutex>

using namespace std;

unordered_map<string, bool> echo_modes_by_token;
mutex echo_state_mutex;
const string DATABASE_ADRESS = "DATABASE/";

// defining the session function : change structure if the functions fails to calibrate with the database(like SQLite,SQL)

string processstrings_profile(
	string order_commands,
	const string& profile,
	string& current_path,
	const string& token
);//command engine here

string CALCULATOR(string calc_command);//calcualtor here

int NUMBERIFIER(vector<int> numbers_UNFIED);//unfied numbers here 

string BRIDGERequest(
	const string& token,
	const string& profile,
	string& current_path,
	const string& op,
	const string& path = "",
	const string& name = "",
	const string& content = "",
	const string& destination = "",
	const string& pattern = "",
	bool confirm = false
);

string get_parent_Path(const string& path);
bool directory_name_validity(const string& name);

bool validprofile(const string& profile)
{
	if (profile.empty() || profile.length() > 64)
	{
		return false;
	}
	for (char c : profile)
	{
		unsigned char CC = static_cast <unsigned char>(c);

		if (!isalnum(CC) && c != '_' && c != '-')
		{
			return false; 
		}
	}
	return true; 
}
string normalize_path(string path)
{
	replace(path.begin(), path.end(), '\\', '/');

	string result;
	bool previous_slash = false;

	for (char c : path)
	{
		if (c == '/')
		{
			if (previous_slash)
			{
				continue;
			}
			previous_slash = true;
		}
		else
		{
			previous_slash = false;
		}
		result += c;
	}

	while (!result.empty() && result.front() == '/')
	{
		result.erase(result.begin());
	}
	while (!result.empty() && result.back() == '/')
	{
		result.pop_back();
	}
	return result;
}

bool validrelativepath(const string& raw_path)
{
	if (!raw_path.empty() && (raw_path.front() == '/' || raw_path.front() == '\\'))
	{
		return false;
	}

	if (raw_path.length() >= 2 && isalpha(static_cast<unsigned char>(raw_path[0])) && raw_path[1] == ':')
	{
		return false;
	}
	string path = normalize_path(raw_path);

	if (path.length() > 1024)
	{
		return false;
	}
	if (path.empty())
	{
		return true;
	}
	if (path.front() == '/' || (path.length() >= 2 && isalpha(static_cast<unsigned char> (path[0])) && path[1] == ':'))
	{
		return false;
	}

	string component;

	for (size_t i = 0; i <= path.size(); i++)
	{
		if (i == path.size() || path[i] == '/')
		{
			if (component.empty() || component == "." || component == "..")
			{
				return false;
			}

			for (char c : component)
			{
				if(iscntrl(static_cast<unsigned char>(c)))
				{
					return false;
				}
			}
			component.clear();
		}
		else
		{
			component += path[i];
		}
	}
	return true;
}

string profile_storage_path(const string& profile, const string& relative_path)
{
	if (!validprofile(profile) || !validrelativepath(relative_path))
	{
		return "";
	}

	string path = normalize_path(relative_path);
	string result = DATABASE_ADRESS + profile + "/Desktop/" + profile;

	if (!path.empty())
	{
		result += "/" + path;
	}

	return result;
}

string join_relative_path(const string& current_path, const string& name)
{
	string current = normalize_path(current_path);
	string child = normalize_path(name);

	if (child.empty())
	{
		return current;
	}
	if (current.empty())
	{
		return child;
	}

	return current + "/" + child;
}

bool directory_name_validity(const string& name)
{
	if (name.empty() || name == "." || name == "..")
	{
		return false;
	}

	if (name.length() > 255)
	{
		return false;
	}

	for (char c : name)
	{
		unsigned char CC = static_cast<unsigned char>(c);

		if (iscntrl(CC))
		{
			return false;
		}
		if (c == '/' || c == '\\')
		{
			return false;
		}
	}
	return true;
}

string get_parent_Path(const string& path)
{
	string normalized = normalize_path(path);

	if (normalized.empty())
	{
		return "";
	}

	size_t position = normalized.find_last_of('/');

	if (position == string::npos)
	{
		return "";
	}

	return normalized.substr(0, position);
}

int main()
{
	crow::App<crow::CORSHandler> app;

	auto& cors = app.get_middleware<crow::CORSHandler>();

	cors.global()
		.origin("*")   
		.headers("Content-Type")
		.methods("GET"_method, "POST"_method, "OPTIONS"_method);

	CROW_ROUTE(app, "/")([]
	{
		return "Hello, World!";
	});
	CROW_ROUTE(app, "/server_bridge")
	([] {

		crow::json::wvalue response;

		response["status"] = "OK";
		response["service"] = "cpp";
		response["message"] = "Backend is online now. Ready for commands ";

		return crow::response(response);
	
	});

	CROW_ROUTE(app, "/json")
		.methods(crow::HTTPMethod::GET,
			crow::HTTPMethod::POST,
			crow::HTTPMethod::OPTIONS )

		([](const crow::request& req)
			{
				if (req.method == crow::HTTPMethod::OPTIONS)
				{
					crow::json::wvalue response;
					response["success"] = true;
					auto res = crow::response(200, response);
					return res;
				}
				
				if (req.method == crow::HTTPMethod::GET)
				{
					crow::json::wvalue response;
					response["success"] = true;
					response["message"] = "This is a GET request";
					auto res = crow::response(200, response);
					return res;
				}
				auto body = crow::json::load(req.body);

				if (!body)
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Invalid JSON";

					auto res = crow::response(400, error);
					return res;
				}

				if (!body["profile"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "missing profile";

					auto res = crow::response(400, error);
					return res;
				}
				
				if (!body["command"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Missing command";

					auto res = crow::response(400, error);
					return res;
				}
				string profile = body["profile"].s();
				string current_path = "";


				//=================================
				if (body["cwd"])
				{
					current_path = body["cwd"].s();
				}
				else if (body["path"])
				{
					current_path = body["path"].s();
				}
				//==================================


				if (!body["token"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "missing token";
					return crow::response(401, error);
				}
				string token = body["token"].s();

				if (!validprofile(profile))
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "invalid profile name";
					auto res = crow::response(400, error);
					return res;
				}

				if (!validrelativepath(current_path))
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Invalid filesystem path";
					auto res = crow::response(400, error);
					return res;
				}
				std::string command = body["command"].s();
				std::string result = processstrings_profile(command,profile,current_path,token);
				crow::json::wvalue response;

				response["success"] = true;
				response["output"] = "   " + result;
				response["profile"] = profile;
				response["path"] = normalize_path(current_path);

				if(body["terminal"])
				{
					response["terminal"] = body["terminal"].i();
				}

				auto res = crow::response(response);
				return res;

			});
	const char* port = std::getenv("PORT");
	app.port(port ? std::stoi(port) : 8080).multithreaded().run();

	//app.port(8080).multithreaded().run();

}

string trim_copy(const string& input)
{
	size_t first = input.find_first_not_of(" \t\r\n");

	if (first == string::npos)
	{
		return "";
	}

	size_t last = input.find_last_not_of(" \t\r\n");

	return input.substr(first, last - first + 1);
}

bool consume_argument(
	const string& input,
	size_t& position,
	string& argument
)
{
	while (
		position < input.size() &&
		isspace(static_cast<unsigned char>(input[position]))
		)
	{
		position++;
	}

	if (position >= input.size())
	{
		return false;
	}

	if (input[position] == '"')
	{
		position++;

		string result;

		while (position < input.size())
		{
			char c = input[position++];

			if (c == '"')
			{
				argument = result;
				return true;
			}

			if (c == '\\' && position < input.size())
			{
				char next = input[position++];

				if (next == '"' || next == '\\')
				{
					result += next;
				}
				else
				{
					result += '\\';
					result += next;
				}
			}
			else
			{
				result += c;
			}
		}

		return false;
	}

	size_t start = position;

	while (
		position < input.size() &&
		!isspace(static_cast<unsigned char>(input[position]))
		)
	{
		position++;
	}

	argument = input.substr(start, position - start);

	return !argument.empty();
}

string processstrings_profile(
	string order_commands,
	const string& profile,
	string& current_path,
	const string& token
)
{
	const string command = trim_copy(order_commands);

	if (!validprofile(profile))
	{
		return " INVALID PROFILE";
	}

	if (!validrelativepath(current_path))
	{
		return "INVALID CURRENT PATH";
	}

	if (token.empty())
	{
		return "Authentication required.";
	}

	auto parse_one = [](
		const string& input,
		string& value
		) -> bool
		{
			size_t position = 0;

			if (!consume_argument(input, position, value))
			{
				return false;
			}

			while (position < input.size() && isspace(static_cast<unsigned char>(input[position])))
			{
				position++;
			}

			return position == input.size();
		};

	auto resolve_path = [&](
		const string& input
		) -> string
		{
			if (input == ".")
			{
				return normalize_path(current_path);
			}

			if (input == "/")
			{
				return "";
			}

			if (!input.empty() && input.front() == '/')
			{
				return normalize_path(input.substr(1));
			}

			return join_relative_path(current_path, input);
		};

	//ECHO code :------------------------->>>

	if (command == "echo")
	{
		lock_guard<mutex> lock(echo_state_mutex);
		echo_modes_by_token[token] = true;

		return
			"ECHO mode started. "
			"Type 'echo stop' to stop echoing. ";
	}

	if (command == "echo stop")
	{
		lock_guard<mutex> lock(echo_state_mutex);
		auto it = echo_modes_by_token.find(token);

		if (it != echo_modes_by_token.end() && it->second)
		{
			it->second = false;

			return "echo mode has been stopped";
		}

		return "echo is already off";
	}
	{
		lock_guard<mutex> lock(echo_state_mutex);
		auto it = echo_modes_by_token.find(token);

		if (it != echo_modes_by_token.end() && it->second)
		{
			return command;
		}
	}

	if (command == "pwd")
	{
		string path = normalize_path(current_path);

		replace(path.begin(), path.end(), '/', '\\');

		if (path.empty())
		{
			return "Desktop:\\" + profile;
		}

		return "Desktop:\\" + profile + "\\" + path;
	}

	if (command == "whoami")
	{
		return "You are USER: " + profile;
	}

	if (command == "introduceyourself")
	{
		return
			"HI! I am VALCON, a browser-based OS like command interface. \n"
			"I am still under devolopment tho...";
	}

	if (command == "help")
	{
		return
			"pwd                                   Show the current directory\n"
			"cd : <path>                           Change directory\n"
			"cd : ..                               Go to the parent directory\n"
			"mkdir : <name>                        Create a directory\n"
			"mkfile : <name>                       Create a file\n"
			"wrtfile : <name> <content>            Replace file or write file contents\n"
			"append : <name> <content>             Append file contents\n"
			"rdfile : <path>                       Read a file\n"
			"deltfile : <path>                     Delete a file\n"
			"deldir : <path>                       Delete a directory\n"
			"deldir : <path> --yes                 Confirm recursize deletion\n"
			"ls                                    List directory contents\n"
			"stat : <path>                         Show file information\n"
			"dir/rename : <new-name>               Rename current directory\n"
			"rename : <new-name>                   Rename current directory\n"
			"move : <source> <dest>                Move an enty\n"
			"copy : <source> <dest>                Copy an entry\n"
			"tree                                  Display directory tree\n"
			"find : <glob>                         Find matching entries\n"
			"grep : <patern>                       Search text files\n"
			"calculate <expression>=               Calculate an expression";
	}

	if (command.rfind("calculate", 0) == 0)
	{
		if (command.size() > 9 && !isspace(static_cast<unsigned char>(command[9])))
		{
			return "Use: calculate 5+4=";
		}

		return "The answer is: " + CALCULATOR(command.substr(9));
	}

	if (command.rfind("mkdir : ", 0) == 0)
	{
		string name;

		if (!parse_one(command.substr(8), name))
		{
			return "Use: mkdir : <name>. Quote names should contain spaces.";
		}

		if (!directory_name_validity(name))
		{
			return "Invalid directory name.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"mkdir",
			"",
			name
		);
	}

	if (command == "/cd" || command == "cd : ..")
	{
		string target = get_parent_Path(current_path);

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"cd",
			target
		);
	}

	if (command.rfind("cd : ", 0) == 0)
	{
		string argument;

		if (!parse_one(command.substr(5), argument))
		{
			return "Use: cd : <directory>. quote names containing spaces.";
		}

		string target;

		if (argument == "..")
		{
			target = get_parent_Path(current_path);
		}
		else
		{
			target = resolve_path(argument);
		}

		if (!validrelativepath(target))
		{
			return "Invalid directory path.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"cd",
			target
		);
	}

	if (command == "ls" || command == "list")
	{
		return BRIDGERequest(
			token,
			profile,
			current_path,
			"ls"
		);
	}

	if (command.rfind("mkfile : ", 0) == 0)
	{
		string name;

		if (!parse_one(command.substr(9), name))
		{
			return "Use: mkfile : <name>.  Quote names containing spaces.";
		}

		if (!directory_name_validity(name))
		{
			return "Invalid filename.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"mkfile",
			"",
			name
		);
	}

	if (command.rfind("wrtfile : ", 0) == 0)
	{
		string data = command.substr(10);

		size_t position = 0;
		string name;

		if (!consume_argument(data, position, name))
		{
			return "Use: wrtfile: <filename> <content>";
		}

		if (!directory_name_validity(name))
		{
			return "Invalid Filename";
		}

		if (position >= data.size() || !isspace(static_cast<unsigned char>(data[position])))
		{
			return "Provide content after the filename.";
		}

		while (position < data.size() && isspace(static_cast<unsigned char>(data[position])))
		{
			position++;
		}

		string content = data.substr(position);

		return BRIDGERequest(
			token,
			profile,
			"write",
			"",
			name,
			content
		);
	}

	if (command.rfind("append : ", 0) == 0)
	{
		string data = command.substr(9);

		size_t position = 0;
		string name;

		if (!consume_argument(data, position, name))
		{
			return "Use: append : <filename> <content>";
		}

		if (!directory_name_validity(name))
		{
			return "Invalid filename.";
		}

		if (position >= data.size() || !isspace(static_cast<unsigned char>(data[position])))
		{
			return "Provide content after the filename.";
		}

		while (position < data.size() && isspace(static_cast<unsigned char>(data[position])))
		{
			position++;
		}

		string content = data.substr(position);

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"append",
			"",
			name,
			content
		);
	}
	
	if (command.rfind("rdfile : ", 0) == 0)
	{
		string argument;

		if (!parse_one(command.substr(9), argument))
		{
			return "Use: rdfile: <path>";
		}

		if (!validrelativepath(argument))
		{
			return "Invalid file path";
		}

		string target = resolve_path(argument);

		if (!validrelativepath(target))
		{
			return "Invalid file path.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"read",
			target
		);
	}

	if (command.rfind("deltfile : ", 0) == 0)
	{
		string argument;

		if (!parse_one(command.substr(11), argument))
		{
			return "Use: deltfile : <path>";
		}

		string target = resolve_path(argument);

		if (!validrelativepath(target))
		{
			return "Invalid file path";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"delete_file",
			target
		);
	}

	if (command.rfind("deldir : ", 0) == 0)
	{
		string argument = trim_copy(command.substr(9));

		bool confirm = false;

		if (argument.size() >= 6 && argument.compare(argument.size() - 6, 6, " --yes") == 0)
		{
			argument = trim_copy(argument.substr(0, argument.size() - 6));
			confirm = true;
		}

		string name;

		if (!parse_one(argument, name))
		{
			return "Use: deldir : <path> [--yes]";
		}

		if (validrelativepath(name) || name.empty())
		{
			return "Invalid directory path.";
		}

		string target = resolve_path(name);

		if (!validrelativepath(target) || target.empty())
		{
			return "The profile root cannot be deleted";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"deldir",
			target,
			"",
			"",
			"",
			"",
			confirm
		);
	}

	if (command.rfind("rename : ", 0) == 0 || command.rfind("dir/rename : ", 0) == 0)
	{
		size_t prefix_legth = command.rfind("dir/rename : ", 0) == 0 ? 13 : 9;

		string new_name;

		if (!parse_one(command.substr(prefix_length), new_name))
		{
			return "Use: rename : <new-name>";
		}

		if (!directory_name_validity(new_name))
		{
			return "Invalid directory name.";
		}

		if (normalize_path(current_path).empty())
		{
			return "The profile root cannot be renamed.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"rename",
			normalize_path(current_path),
			new_name
		);
	}

	if (command.rfind("move : ", 0) == 0 || command.rfind("copy : ", 0) == 0)
	{
		bool is_move = command.rfind("move : ", 0) == 0;
		string data = command.substr(7);
		size_t position = 0;

		string source;
		string destination;

		if (!consume_argument(data, position, source) || !consume_argument(data, position, destination))
		{
			return is_move ? "Use: move : <source> <destination-directory>" : "Use: copy : <source> <destination-directory>";
		}

		while (position < data.size() && isspace(static_cast<unsigned char>(data[position])))
		{
			position++;
		}

		if (position != data.size())
		{
			return "Quote paths containing spaces.";
		}

		if (!validrelativepath(source) || !validrelativepath(destination))
		{
			return "INVALID SOURCE OR DEST PATH";
		}

		string source_path = resolve_path(source);
		string destination_path = resolve_path(destination);

		if (source_path.empty() || !validrelativepath(source_path) || !validrelativepath(destination_path))
		{
			return "INVALID SOURCE OR DEST PATH";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			is_move ? "move" : "copy",
			source_path,
			"",
			"",
			destination_path
		);
	}

	if (command.rfind("stat : ", 0) == 0)
	{
		string argument;
		if (!parse_one(command.substr(7), argument))
		{
			return "Use: stat: <path>";
		}

		if (!validrelativepath(argument))
		{
			return "Invalid path";
		}

		string target = resolve_path(argument);

		return BRIDGEequest(
			token,
			profile,
			current_path,
			"stat",
			target
		);
	}

	if (command == "tree")
	{
		return BRIDGERequest(
			token,
			profile,
			current_path,
			"tree"
		);
	}

	if (command.rfind("find : ", 0) == 0)
	{
		string pattern;

		if (!parse_one(command.substr(7), pattern))
		{
			return "USe : find : <glob>";
		}

		if (pattern.empty())
		{
			return "Provide a search pattern.";
		}

		return BRIDGERequest(
			token,
			profile,
			current_path,
			"find",
			"",
			"",
			"",
			"",
			pattern
		);
	}

	return
		"NO COMMAND FOUND :(  -->" + command + "\n"
		"TRY help FOR THE COMMAND SHOWCASE";
}

static size_t WriteCallback(void* contents, size_t size, size_t nmeb, void* userp)
{
	if (contents == nullptr || userp == nullptr)
		return 0;

	size_t total = size * nmeb;

	std::string* response = static_cast<std::string*>(userp);

	response->append(
		static_cast<const char*>(contents),
		total
	);
	return total;
}

static string get_env_required(const char* name)
{
	const char* value = std::getenv(name);

	if (value == nullptr || string(value).empty())
	{
		return "";
	}

	return string(value);
}

string BRIDGERequest(
	const string& token,
	const string& profile,
	string current_path,
	const string& op,
	const string& path,
	const string& name,
	const string& content,
	const string& destination,
	const string& pattern,
	bool confirm
)
{
	string bridge_url = get_env_required("BRIDGE_URL");
	string bridge_key = get_env_required("VALCON_BRIDGE_KEY");

	if (bridge_url.empty())
	{
		return "Bridge configuratyion error: URL missing <STATE> <NODE_BRIDGE>";
	}
	if (bridge_key.empty())
	{
		return "Bridge config error: KEY missing";
	}
	if (token.empty())
	{
		return "Authentication required";
	}
	if (!validprofile(profile))
	{
		return "Invalid profile";
	}
	if (!validprofile(current_path))
	{
		return "Invalid current directory";
	}
	
	while (!bridge_url.empty() && bridge_url.back() == '/')
	{
		bridge_url.pop_back();
	}

	CURL* curl = curl_easy_init();

	if (curl == nullptr)
	{
		return "CURL INITIALIZATION FAILED";
	}
	string response;
	crow::json::wvalue request_body;

	request_body["token"] = token;
	request_body["profile"] = profile;
	request_body["cwd"] = normalize_path(current_path);
	request_body["op"] = op;

	if (
		!path.empty() ||
		op == "cd" ||
		op == "read" ||
		op == "delete_file" ||
		op == "deldir" ||
		op == "rename" ||
		op == "move" ||
		op == "copy"
		)
	{
		request_body["path"] = normalize_path(path);
	}

	if (!name.empty())
	{
		request_body["name"] = name;
	}

	if(!)
}

string CALCULATOR(string calc_command)
{   //we need to implement calculate logics here to make sure the calculator works
	//1.st that dont touch this function cuz hour wasted here is miserable and emotionaly damageble
	//hour wasted = 5hr
	if (calc_command.find("=") == string::npos)
	{
		return "ERROR! GIVE THE EQUAL AT THE LAST :( .";
	}
	string super_varie = calc_command.substr(0, calc_command.find("="));
	size_t position = 0;

	auto skip_spaces = [&]()
	{
		while (position < super_varie.length() && isspace(static_cast<unsigned char>(super_varie[position])))
		{
			position++;
		}
	};

	function<double()> expression;
	function<double()> term;
	function<double()> factor;

	factor = [&]() -> double
	{
		skip_spaces();
		//for negtive numbers
		if (position < super_varie.length() && super_varie[position] == '-')
		{
			position++;
			return -factor();
		}
		//for positive number
		if (position < super_varie.length() && super_varie[position] == '+')
		{
			position++;
			return factor();
		}
		//for Brackets
		if (position < super_varie.length() && super_varie[position] == '(')
		{
			position++;
			double answer = expression();
			skip_spaces();
			if (position >= super_varie.length() || super_varie[position] != ')')
			{
				throw runtime_error("Missing closing bracket");
			}
			position++;
			return answer;
		}
		//for collect digits
		vector<int> numbers;
		while (position < super_varie.length() && isdigit(static_cast<unsigned char>(super_varie[position])))
		{
			numbers.push_back(super_varie[position] - '0');
			position++;
		}
		if (numbers.empty())
		{
			throw runtime_error("Expected a number");
		}
		//NUMBERIFY
		return NUMBERIFIER(numbers);
	};
	// MULTIPLICATION / DIVISION
	term = [&]() -> double
	{
		double answer = factor();
		while (true)
		{
			skip_spaces();
			if (position >= super_varie.length())
				break;
			if (super_varie[position] == '*')
			{
				position++;
				answer = answer * factor();
			}
			else if (super_varie[position] == '/')
			{
				position++;
				double divisor = factor();
				if (divisor == 0)
				{
					throw runtime_error("Cannot divide by zero");
				}
				answer = answer / divisor;
			}
			else
			{
				break;
			}
		}
			return answer;
	};
	// ADDITION / SUBTRACTION
	expression = [&]() -> double
	{
		double answer = term();
		while (true)
		{
		skip_spaces();

			if (position >= super_varie.length())
				break;

			if (super_varie[position] == '+')
			{
				position++;
				answer = answer + term();
			}
			else if (super_varie[position] == '-')
			{
				position++;
				answer = answer - term();
			}
			else
			{
				break;
			}
		}
		return answer;
	};
	try
	{
		double final_answer = expression();

		skip_spaces();

		if (position != super_varie.length())
		{
			throw runtime_error("Invalid calculation");
		}

		if (floor(final_answer) == final_answer)
		{
			return to_string(static_cast<long long>(final_answer));
		}
		string answer = to_string(final_answer);

		while (!answer.empty() && answer.back() == '0')
		{
			answer.pop_back();
		}

		if (!answer.empty() && answer.back() == '.')
		{
			answer.pop_back();
		}
		return answer;
	}
	catch (const exception& error)
	{
		return string("CALCULATOR ERROR: ") + error.what();
	}
}
int NUMBERIFIER(vector<int> numbers_UNFIED)
{
	reverse(numbers_UNFIED.begin(), numbers_UNFIED.end());
	int number_UNFIED = 0;
	for (int j = 0; j < numbers_UNFIED.size(); j++)
	{
		number_UNFIED += numbers_UNFIED[j] * pow(10, j);
	}
	return number_UNFIED;
}

//VALCON COMPLETE !