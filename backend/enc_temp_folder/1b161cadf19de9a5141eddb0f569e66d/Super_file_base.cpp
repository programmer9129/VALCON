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
string processstrings(string order_commands);
string CALCULATOR(string calc_command);
int NUMBERIFIER(vector<int> numbers_UNFIED);//unfied numbers here 

//this code is been made for bridge request HAZARD! do not touch this function in any matterr
// this can delete the whole thing i mean the whole database 
string BRIDGERequest(
	const stirng& method,
	const string& filename,
	const string& content = ""
)
{
	CURL* curl = curl_easy_init();

	if (!curl)
		return "CURL initialization failed";

	string response;

	string url = "https://valcon-1.onrender.com/server_bridge/files/" + method;
	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());

	struct curl_slist* header = nullptr;
	headers = curl_slist_append(
		headers,
		"Content-Type: plain/text"
	);
	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	string.json =
		"{\"filename\""\"" + filename + "\"";

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
		stirng readURL =
			"https://valcon-1.onrender.com/server_bridge/files/read/" + filename;

		curl_easy_setopt(curl, CURLOPT_URL, readUrl.c_str());
		curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);

	}
	else if (method == "delete")
	{
		string deleteUrl = "https://valcon-1.onrender.com/server_bridge/files/delete/" + filename;

		curl_easy_setopt(curl, CURLOPT_URL, readUrl.c_str());
		curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");

	}
	
	curl_easy_setopt(
		curl,
		CURLOPT_WRITEFUNCTION,
		[](char* data, size_t size, size_t count.void* user)
		{
			string* result = static_cast<string*>(user);

			result->append(data, size * count);

			return size * count;
		}
	);

	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_slist result = curl_easy_perform(curl);

	if (result != CURLE_OK)
	{
		response =
			"Bridge error:" + string(curl_easy_strerror(result));
	}

	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);

	return response;

}// SYSTEM OF BRIDGE NAD FILES ACCESS SYSTEM IS READY NOW BE IN ACTION .!!do not touch the code 

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
	CROW_ROUTE(app, "/health_bridge")
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
				crow::json::wvalue response;
				std::string result = processstrings(command);
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
	order_commands.erase(remove(order_commands.begin(), order_commands.end(), ' '), order_commands.end());
	if (order_commands == "help")
	{
		return
			" who am i --> Says who are You. \n"
			" calculate {your calculation input} --> Calculate The Calculation Input. \n"
			" start echo --> echo what the USER says. \n"
			" introduce yourself --> Introduce itself to USER.\n"
			" folder open {name of the folder} --> open the folder USER want. \n"
			" file open {name of the file} --> open the file USER want. \n "
			" Valcon Show directory sequence --> the comand show the directory sequence of files nad folders. \n";
	}
	if (order_commands == "introduceyourself")
	{
		return
			" Hi!, I am Valcon .A Web CLI Application, I can do much things. \n"
			" to be continued \n";
	}
	if (search_calculate != std::string::npos)
	{
		std::string calc_command = order_commands.substr(9);
		std::string answer = CALCULATOR(calc_command);
		return answer;
	}
	if (order_commands == "startecho")
	{
		bool access_desk = true;
		while (access_desk)
		{
			if (order_commands == "stopecho")
			{
				access_desk = false;
			}
			std::string echo_string = order_commands;
			return echo_string;
		}
	}
	if (order_commands.rfind("file create", 0) == 0)
	else {
		return "no command found";
	}
}
string CALCULATOR(string calc_command)
{
	//we need to implement calculate logics here to make sure the calculator works
	//1.st that dont touch this function cuz hour wasted here is miserable and emotionaly damageble
	//hour wasted = 4hr
	std::string super_varie = calc_command;
	std::vector<int>numbers;
	std::vector<int>unified_number_set;
	std::vector<char>operator_set;
	std::vector<std::string>operators = { "+", "-","=" };
	int number = 0;
	int sum_answer = 0;
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
		else if 
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
