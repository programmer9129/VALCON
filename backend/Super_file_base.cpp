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

unordered_map<string, bool> profile_echo_modes;
mutex profile_state_mutex;
const string DATABASE_ADRESS = "DATABASE/";

// defining the session function : change structure if the functions fails to calibrate with the database(like SQLite,SQL)

string processstrings_profile(string order_commands, const string& profile, string& current_path);//command engine here
string CALCULATOR(string calc_command);//calcualtor here
int NUMBERIFIER(vector<int> numbers_UNFIED);//unfied numbers here 
string BRIDGERequest(
	const string& method,
	const string& profile,
	const string& path,
	const string& content = ""
);
//bridge to supabase here 
string FOLDERRequest
(
	const string& method,
	const string& profile,
	const string& path,
	const string& new_name = ""

);
string get_parent_path(const string& path);
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

string join_relative_path(string& current_path, const string& name)
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

bool derectory_name_validity(const string& name)
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

				if (body["path"])
				{
					current_path = body["path"].s();
				}

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
				std::string result = processstrings_profile(command,profile,current_path);
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

string processstrings_profile(string order_commands, const string& profile, string& current_path)
{
	size_t search_calculate = order_commands.find("calculate");
	auto ichy_file_nameworks = order_commands;	
	if (ichy_file_nameworks == "echo")
	{
		lock_guard<mutex> lock(profile_state_mutex);
		profile_echo_modes[profile] = true;
		return "LET'S ECHO!, IT WILL BE A FUN I HOPE! ;) . type 'echo stop' to stop echoing.";
	}

	if (ichy_file_nameworks == "echo stop")
	{
		lock_guard<mutex> lock(profile_state_mutex);

		if (profile_echo_modes[profile])
		{
			profile_echo_modes[profile] = false;
			return "echo mode stopped";
		}
		else
		{
			return "SORRY I THINK ECHO MODE IS OFF";
		}
	}

	{
		lock_guard<mutex> lock(profile_state_mutex);
		if (profile_echo_modes[profile])
		{
			return ichy_file_nameworks;
		}
	}
	
	order_commands.erase(remove(order_commands.begin(), order_commands.end(), ' '), order_commands.end());

	if (ichy_file_nameworks == "pwd")
	{
		string path = normalize_path(current_path);

		replace(path.begin(), path.end(), '/', '\\');

		if (path.empty())
		{
			return "desktop:\\" + profile;
		}
		return "desktop:\\" + profile + "\\" + path;
	}

	if (ichy_file_nameworks.rfind("mkdir : ", 0) == 0)
	{
		string folder_name;
		folder_name = ichy_file_nameworks.substr(8);
		if (!derectory_name_validity(folder_name))
		{
			return "Invalid folder name.";
		}
		string target_path = join_relative_path(current_path, folder_name);
		return FOLDERRequest("mkdir", profile, target_path);
	}

	if (ichy_file_nameworks == "/cd")
	{
		if (normalize_path(current_path).empty())
		{
			return "already at directory... ";
		}

		current_path = get_parent_path(current_path);

		return "Directory changed to: " + (normalize_path(current_path).empty() ? string("desktop:\\") + profile : string("desktop:\\") + profile + "\\" + string([](string p)
			{
				replace(p.begin(), p.end(), '/', '\\');
				return p;
			}(normalize_path(current_path))));
	}

	if (ichy_file_nameworks.rfind("cd : ", 0) == 0)
	{
		string folder_name = ichy_file_nameworks.substr(5);
		if (!directory_name_validity(folder_name))
		{
			return "Invalid Directory Name.";
		}

		string target_path = join_relative_path(current_path, folder_name);
		string result = FOLDERRequest("cd", profile, target_path);

		if (result == "DIRECTORY_EXISTS")
		{
			current_path = target_path;
			return "Directory changed to: " + (string("desktop:\\") + profile + "\\" + string([](string p)
			{
				replace(p.begin(), p.end(), '/', '\\');
				return p;

			}(normalize_path(current_path))));

		}
		return result;

	}

	if (ichy_file_nameworks.rfind("deldir : ", 0) == 0)
	{
		string folder_name = ichy_file_nameworks.substr(9);
		if (!directory_name_validity(folder_name))
		{
			return " Invalid folder name...";
		}

		string target_path = join_relative_path(current_path, folder_name);

		return FOLDERRequest("deldir", profile, target_path);
	}

	if (ichy_file_nameworks == "list")
	{
		return FOLDERRequest("list", profile, current_path);
	}

	if (ichy_file_nameworks == "super_list")
	{
		return FOLDERRequest("super_list", profile, "");
	}

	if (ichy_file_nameworks.rfind("dir/rename : ", 0) == 0)
	{
		string new_name = ichy_file_nameworks.substr(13);

		if (!directory_name_validity(new_name))
		{
			return "INVALID FOLDERNAME";
		}

		string old_path = normalize_path(current_path);

		if (old_path.empty())
		{
			return " the profile directory cant be renamed..";
		}

		string parent_path = get_parent_path(old_path);
		string new_path = join_relative_path(parent_path, new_name);
		string result = FOLDERRequest("rename", profile, old_path, new_path);

		if (result == "RENAME_SUCCESS")
		{
			current_path = new_path;

			return "directory renamed to : " + new_name;
		}

		return result;
	}

	if (order_commands == "whoami")
	{
		return "YOU ARE USER..." + profile + "." + " BEEP BEEP ... I AM HAPPY TO WORK WITH YOU :D \n";
		return "I HOPE YOU WILL LIKE ME {^-^}";
	}
	if (order_commands == "help")
	{
		return
			" introduce yourself --> Introduce itself to USER.\n"
			" who am i --> says who are you to VALCON \n"
			" calculate {your calculation input} --> Calculate The Calculation Input. give the command like 'calculate 5+4=' \n"
			" echo --> echo what the USER says. \n"			
			" mkfile : {name of the file}.txt --> create the file USER want. \n "
			" wrtfile : {name of the file}.txt {context of the file} --> write the txt context into the file you gave \n"
			" rdfile : {name of the file}.txt --> the terminal will show you what in written in the file \n"
			" deltfile : {name of the file}.txt ==> CAREFUL! this command will delete your text file \n"
			" lsfile --> this command will show the list of the files in the database \n"
			"\n"
			"\n"
			"\n"
			"NOTE: THIS IS A UNDER_DEVOLOPING PROJECT SO, THERE IS NOT MUCH FEATURES LIKE THE NAME ITSELF...\n"
			"      WE HOPE YOU WILL LIKE 'VALCON'\n  "
			"      WE ARE WORKING ON MANY FEATURES.. AND THAT WILL TAKE TIME, ON NEXT UPDATE, WE HOPE WE CAN IMPRESS YOU MORE! ";
	}
	if (order_commands == "introduceyourself")
	{
		return
			" Hi!, I am Valcon .A Web CLI Application, I can do much things. \n"
			"I am still Under devolopment please don't mind... :) \n"
			"My creators are trying to make me improved and better. ;) \n"
			"btw nice to meet YOU!.\n"
			"What can I do for you now ? :D ";
	}
	if (order_commands == "pwd")
	{
		string path = normalize_path(current_path);
		if (path.empty())
		{
			return "desktop:\\" + profile;
		}
		replace(path.begin(), path.end(), '/', '\\');

		return "desktop:\\" + profile + "\\" + path;
	}
	if (search_calculate != std::string::npos)
	{
		std::string calc_command = order_commands.substr(9);
		std::string answer = CALCULATOR(calc_command);
		return "the anser is :--> " + answer;
	}
	if (ichy_file_nameworks.rfind("mkfile : ", 0) == 0)
	{
		string ichyname = ichy_file_nameworks.substr(9);
		if (ichyname.find(".txt") == string::npos)
		{
			ichyname += ".txt";
			string target_path = join_relative_path(current_path, ichyname);
			return BRIDGERequest("create", profile, target_path);
		}
		else if (ichyname.find(".txt") != string::npos)
		{
			string target_path = join_relative_path(current_path, ichyname);
			return BRIDGERequest("create", profile, target_path);
			
		}
		else
		{
			return "Sorry! USER, That feature is still under devolopment,\n"
				"   we are already researching on that ,hope next time if,\n"
				"   no massacare or difficulties happens YOU will see your needed feature here .";
		}
	}
	if (ichy_file_nameworks.rfind("wrtfile : ", 0) == 0)
	{
		string data = ichy_file_nameworks.substr(10);
		size_t space = data.find(' ');

		if (space == string::npos)
		{
			return "OHHH! USE THIS FORMAT PLEASE {^-^}file write : <FILENAME> <CONTENT> ";
		}

		string NAME_OF_THE_FILES = data.substr(0, space);
		string CONTENT_OF_THE_FILE = data.substr(space + 1);

		if (NAME_OF_THE_FILES.find(".txt") == string::npos)
		{
			NAME_OF_THE_FILES += ".txt";
		}
		string target_path = join_relative_path(current_path, NAME_OF_THE_FILES);
		return BRIDGERequest("write", profile, target_path, CONTENT_OF_THE_FILE);
	}
	if (ichy_file_nameworks.rfind("rdfile : ", 0)==0)
	{
		string ichyname = ichy_file_nameworks.substr(9);

		if (ichyname.find(".txt") == string::npos)
		{
			ichyname += ".txt";
		}
		string target_path = join_relative_path(current_path, ichyname);
		std::string result_of_read = BRIDGERequest("read", profile, target_path);
		size_t content_start = result_of_read.find("\"content\":\"");
		if (content_start != string::npos)
		{
			content_start += 11;
			size_t content_end = result_of_read.find("\"", content_start);
			if (content_end != string::npos)
			{
				return result_of_read.substr(content_start, content_end - content_start);
			}
		}
		return "READ FAILED :(";
		
	}
	if (ichy_file_nameworks.rfind("deltfile : ",0) == 0)//CODE TO DELETE
	{
		string ichyname = ichy_file_nameworks.substr(11);

		if (ichyname.find(".txt") == string::npos)
		{
			 ichyname += ".txt";
		}

		string target_path = join_relative_path(current_path, ichyname);

		return BRIDGERequest("delete", profile, target_path);
		
	}
	if (ichy_file_nameworks.rfind("lsfile", 0) == 0)//LIST CODE
	{
		string result_of_list = BRIDGERequest("list", profile, current_path);
		size_t files_start = result_of_list.find("\"files\":[");
		if (files_start == string::npos)
		{
			return "Could not load your files.";
		}

		files_start += 9;
		string furnished_list =
			"\n"
			"Your files\n"
			"-------------------------\n";

		int file_count = 0;
		size_t position = files_start;

		while (true)
		{
			size_t name_start =	result_of_list.find("\"name\":\"", position);
			
			if (name_start == string::npos)
				break;

			name_start += 8;
			size_t name_end = result_of_list.find("\"", name_start);

			if (name_end == string::npos)
				break;

			string filename = result_of_list.substr(name_start,name_end - name_start);
			if (filename == ".emptyFolderPlaceholder")
			{
				position = name_end + 1;
				continue;
			}
			file_count++;

			furnished_list += "  " + to_string(file_count) + ". " + filename + "\n";
			position = name_end + 1;
		}
		if (file_count == 0)
		{
			furnished_list += "  No files yet.\n";
		}
		furnished_list += "-------------------------\n";

		if (file_count == 1)
		{
			furnished_list += "1 file";
		}
		else
		{
			furnished_list += to_string(file_count) + " files";
		}
		return furnished_list;
	}
	else
	{
		return "no command found :(";
	}
}
//this code is been made for bridge request HAZARD! do not touch this function in any matterr
// this can delete the whole thing i mean the whole database...
//althou there is no auto database cleanup so, we need to manualy clear our database :) 
//@GuruOrGoru please dont change this thing up in any matter...
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
string escape_json(const string& input)
{
	string output;

	for (char c : input)
	{
		switch (c)
		{
		case '"':
			output += "\\\"";
			break;
		case '\\':
			output += "\\\\";
			break;
		case '\n':
			output += "\\n";
			break;
		case '\r':
			output += "\\r";
			break;
		case '\t':
			output += "\\t";
			break;
		default:
			output += c;
			break;
		}
	}

	return output;
}
string BRIDGERequest(
	const string& method,
	const string& profile,
	const string& path,
	const string& content = "")
{
	if (!validprofile(profile))
	{
		return "Invalid profile";
	}

	if (!validrelativepath(path))
	{
		return "Invalid filesystem path.";
	}

	CURL* curl = curl_easy_init();

	if (!curl)
		return "CURL initialization failed";

	string response;
	string filename = DATABASE_ADRESS + profile + "/Desktop/" + profile;
	if (!path.empty())
	{
		filename += "/" + path;
	}
	const string bridge_base_url = "https://valcon-1.onrender.com";
	string normalized_path = normalize_path(path);

	string json = "{\"profile\":\"" + profile + "\",\"path\":\"" + normalized_path + "\"";
	if (!content.empty())
	{
		json +=
			",\"content\":\"" + escape_json(content) + "\"";
	}
	json += "}";

	struct curl_slist* headers = nullptr;

	headers = curl_slist_append(
		headers,
		"Content-Type: application/json"
	);
	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
		
	if (method == "create")
	{
		string url = bridge_base_url + "/server_bridge/files/create" ;

		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());

	}
	else if (method == "write")
	{
		string url =
			bridge_base_url + "/server_bridge/files/write";

		curl_easy_setopt(curl,CURLOPT_URL,url.c_str());
		curl_easy_setopt(curl,CURLOPT_POST,	1L);
		curl_easy_setopt(curl,CURLOPT_POSTFIELDS,json.c_str());
	}
	else if (method == "read")
	{
		string readURL = bridge_base_url + "/server_bridge/files/read/" + normalized_path;

		curl_easy_setopt(curl, CURLOPT_URL, readURL.c_str());
		curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());

	}
	else if (method == "delete")
	{
		string deleteURL= bridge_base_url + "/server_bridge/files/delete/" + normalized_path;

		curl_easy_setopt(curl, CURLOPT_URL, deleteURL.c_str());
		curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
		//curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());


	}
	else if (method == "list")
	{
		string listURL = bridge_base_url + "/server_bridge/files/list";

		curl_easy_setopt(curl, CURLOPT_URL, listURL.c_str());
		curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
		//curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else
	{
		curl_slist_free_all(headers);
		curl_easy_cleanup(curl);
	}

	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

	CURLcode result = curl_easy_perform(curl);

	if (result != CURLE_OK)
	{
		response =
			"Bridge error:" + string(curl_easy_strerror(result));
	}
	long http_code = 0;
	curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);
	if (method == "write")
	{
		return "file: " + path + " been updated...";
	}
	if (method == "create")
	{
		return "file: " + path + " has been created";
	}
	if (method == "delete")
	{
		return "file: " + path + " is deleted ";
	}
	else {
		return response;
	}
	return "HTTP " + to_string(http_code) + "\n" + response;

}// SYSTEM OF BRIDGE NAD FILES ACCESS SYSTEM IS READY NOW BE IN ACTION .!!do not touch the code 

string FOLDERRequest(const string& method, const string& profile, const string& path, const string& new_name)
{
	if (!validprofile(profile))
	{
		return "Invalid profile";
	}

	if (!validrelativepath(path))
	{
		return "Invalid filesystem path";
	}

	if (!new_name.empty() && !validrelativepath(new_name))
	{
		return "invalid target path.";
	}

	if (!curl)
	{
		return "initialization failed";
	}

	string response;

	const string bridge_base_url = "https://valcon-1.onrender.com";

	string normalized_path = normalize_path(path);
	string json = "{\"profile\":\"" + escape_json(profile) + "\",\path\":\"" + escape_json(normalized_path) + "\"";

	if (!new_name.empty())
	{
		json += ",\"new_path\":\"" + escape_json(normalize_path(new_name)) + "\"";
	}

	json += "}";
	struct curl_slist* headers = nullptr;
	headers = curl_slist_append(headers, "Content-Type: application/json");

	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	string url;
	if (method == "mkdir")
	{
		url = bridge_base_url + "/server_bridge/folders/mkdir";

		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else if (method == "cd")
	{
		url = bridge_base_url + "/server_bridge/folders/check";
		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELD, json.c_str());
	}
	else if (method == "deldir")
	{
		url = bridge_base_url + "/server_bridge/folders/delete";

		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else if (method == "list")
	{
		url = bridge_base_url + "/server_bridge/folders/list";
		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else if (method == "super_list")
	{
		url = bridge_base_url + "/server_bridge/folders/super-list";
		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else if (method == "rename")
	{
		url = bridge_base_url + "/server_bridge/folders/rename";

		curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
	}
	else
	{
		curl_slist_free_all(headers);
		curl_easy_cleanup(curl);
		return "Unknownn folder operation.";
	}
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

	curl_slist result = curl_easy_perform(curl);
	if (result != CURLE_OK)
	{
		response = "Bridge error: " + string(curl_easy_strerror(result));
	}
	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);

	if (method == "cd")
	{
		if (response.find("\"exists\":true") != string::npos)
		{
			return "DIRECTORY_EXISTS";
		}

		return "directory doesnt exist";
	}
	if (method == "mkdir")
	{
		if (response.find("\"success\":true") != string::npos)
		{
			return "folder created: " + normalized_path;
		}
		return "Folder creation Failed";
	}
	if (method == "deldir")
	{
		if (response.find("\"success\":true") != string::npos)
		{
			return "Folder deleted with all its contents: " + normalized_path;
		}

		return "folder deletion failed";
	}
	if (method == "rename")
	{
		if (response.find("\"success\":true") != string::npos)
		{
			return "RENAME_SUCCESS";
		}

		return "Folder rename failed";
	}

	return response;
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