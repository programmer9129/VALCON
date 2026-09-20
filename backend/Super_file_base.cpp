// Super_file_base.cpp : Defines the entry point for the application.
//

#include "Super_file_base.h"
#include "crow.h"
#include "crow/middlewares/cors.h"
#include <string.h>
#include <algorithm>
#include <cstdlib>
#include <vector>
#include <cmath>
#include <curl/curl.h>

using namespace std;

bool echo_mode = false;
string processstrings(string order_commands);//command engine here
string CALCULATOR(string calc_command);//calcualtor here
int NUMBERIFIER(vector<int> numbers_UNFIED);//unfied numbers here 
string BRIDGERequest(const string& method, const string& filename, const string& content = "");//bridge to supabase here 


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

				if (!body["command"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Missing command";

					auto res = crow::response(400, error);
					return res;
				}

				std::string command = body["command"].s();
				std::string result = processstrings(command);
				crow::json::wvalue response;
				response["success"] = true;
				response["output"] = "   " + result;

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
string processstrings(string order_commands)
{
	size_t search_calculate = order_commands.find("calculate");
	auto ichy_file_nameworks = order_commands;	
	if (ichy_file_nameworks == "start echo")
	{
		echo_mode = true;
		return "LET'S ECHO!, IT WILL BE A FUN I HOPE! ;) . type 'stop echo' to stop echoing.";
	}

	if (ichy_file_nameworks == "stop echo")
	{
		if (echo_mode)
		{
			echo_mode = false;
			return "echo mode stopped";
		}
		else
		{
			return "SORRY I THINK ECHO MODE IS OFF";
		}
	}
	if (echo_mode)
	{
		return ichy_file_nameworks;
	}
	order_commands.erase(remove(order_commands.begin(), order_commands.end(), ' '), order_commands.end());
	if (order_commands == "help")
	{
		return
			" introduce yourself --> Introduce itself to USER.\n"
			" calculate {your calculation input} --> Calculate The Calculation Input. give the command like 'calculate 5+4='. \n"
			" start echo --> echo what the USER says. \n"			
			" file create : {name of the file}.txt --> open the file USER want. \n "
			" file write : {name of the file}.txt {context of the file} --> write the txt context into the file you gave \n"
			" file read : {name of the file}.txt --> the terminal will show you what in written in the file \n"
			" file delete : {name of the file}.txt ==> CAREFUL! this command will delete your text file \n"
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
			"I am still Under devolopment please don't mind... :) ."
			"My creators are trying to make me improved and better. ;)"
			"btw nice to meet YOU!.\n"
			"What can I do for you now ? :D .";
	}
	if (search_calculate != std::string::npos)
	{
		std::string calc_command = order_commands.substr(9);
		std::string answer = CALCULATOR(calc_command);
		return answer;
	}
	if (ichy_file_nameworks.rfind("file create : ", 0) == 0)
	{
		string ichyname = ichy_file_nameworks.substr(14);
		if (ichyname.find(".txt") == string::npos)
		{
			ichyname += ".txt";

			return BRIDGERequest("create", ichyname);
		}
		else if (ichyname.find(".txt") != string::npos)
		{
			return BRIDGERequest("create", ichyname);
		}
		else
		{
			return "Sorry! USER, That feature is still under devolopment,\n"
				"   we are already researching on that ,hope next time if,\n"
				"   no massacare or difficulties happens YOU will see your needed feature here .";
		}
	}
	if (ichy_file_nameworks.rfind("file write : ", 0) == 0)
	{
		string data = ichy_file_nameworks.substr(13);
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
		return BRIDGERequest("write", NAME_OF_THE_FILES, CONTENT_OF_THE_FILE);
	}
	if (ichy_file_nameworks.rfind("file read : ", 0)==0)
	{
		string ichyname = ichy_file_nameworks.substr(12);

		if (ichyname.find(".txt") == string::npos)
		{
			ichyname += ".txt";
		}
		return BRIDGERequest("read", ichyname);
	}
	if (ichy_file_nameworks.rfind("file delete : ",0) == 0)
	{
		string ichyname = ichy_file_nameworks.substr(14);

		if (ichyname.find(".txt") == string::npos)
		{
			 ichyname += ".txt";
		}

		return BRIDGERequest("delete", ichyname);
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

	std::stirng* response = static_cast<std::string*>(userp);

	response->append(
		static_cast<const char*>(contents),
		total
	);
	return total;
}
string BRIDGERequest(
	const string& method,
	const string& filename,
	const string& content)
{
	CURL* curl = curl_easy_init();

	if (!curl)
		return "CURL initialization failed";

	string response;

	string url = "https://valcon-1.onrender.com/server_bridge/files/" + method;
	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());

	struct curl_slist* headers = nullptr;
	headers = curl_slist_append(
		headers,
		"Content-Type: application/json"
	);
	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	string json ="{\"filename\":\"" + filename + "\"";

	if (!content.empty())
	{
		json += ",\"content\":\"";
		for (char c : content)
		{
			if (c == '"')
			{
				json += "\\\"";
			}
			else if (c == '\\')
			{
				json += "\\\\";
			}
			else if (c == '\n')
			{
				json += "\\n";
			}
			else
			{
				json += c;
			}
		}json += "\"";
	}
	json += "}";

	if (method == "create" || method == "write")
	{
		curl_easy_setopt(curl, CURLOPT_POST, 1L);
		curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());

	}
	else if (method == "read")
	{
		string readURL = "https://valcon-1.onrender.com/server_bridge/files/read/" + filename;

		curl_easy_setopt(curl, CURLOPT_URL, readURL.c_str());
		curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);

	}
	else if (method == "delete")
	{
		string deleteURL= "https://valcon-1.onrender.com/server_bridge/files/delete/" + filename;

		curl_easy_setopt(curl, CURLOPT_URL, deleteURL.c_str());
		curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");

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

	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);

	return response;

}// SYSTEM OF BRIDGE NAD FILES ACCESS SYSTEM IS READY NOW BE IN ACTION .!!do not touch the code 

string CALCULATOR(string calc_command)
{
	//we need to implement calculate logics here to make sure the calculator works
	//1.st that dont touch this function cuz hour wasted here is miserable and emotionaly damageble
	//hour wasted = 4hr
	std::string super_varie = calc_command;
	std::vector<int>numbers;
	std::vector<int>unified_number_set;
	std::vector<char>operator_set;
	std::vector<std::string>operators = { "+", "-","*","/"};
	int number = 0;
	int sum_answer = 0;
	if (super_varie.find("=") == string::npos)
	{
		return "ERROR! GIVE THE EQUAL AT THE LAST :( .";
	}
	for (int i = 0; i <= super_varie.length(); i++)
	{
		if (isdigit(super_varie[i]))
		{
			numbers.push_back(super_varie[i] - '0');
		}
		if (super_varie[i] != NULL)
		{
			if (std::find(operators.begin(), operators.end(), std::string(1, super_varie[i])) != operators.end())
			{
				number = NUMBERIFIER(numbers);
				unified_number_set.push_back(number);
				operator_set.push_back(super_varie[i]);
				numbers.clear();
				number = 0;
			}
		}
		else
		{
			number = NUMBERIFIER(numbers);
			unified_number_set.push_back(number);
			numbers.clear();
			number = 0;
		}		
	}
	sum_answer = unified_number_set[0];
	unified_number_set.erase(unified_number_set.begin() + 0);
	int x = 0;
	for (char y : operator_set)
	{
		if (y == '+')
		{
			sum_answer = sum_answer + unified_number_set[x];
		}
		else if (y == '-')
		{
			sum_answer = sum_answer - unified_number_set[x];
		}
		else if (y == '*')
		{
			sum_answer = sum_answer * unified_number_set[x];
		}
		else if (y == '/')
		{
			sum_answer = sum_answer / unified_number_set[x];
		}
		x++;
	}
	return std::to_string(sum_answer);
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
