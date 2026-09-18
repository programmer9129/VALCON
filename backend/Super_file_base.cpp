// Super_file_base.cpp : Defines the entry point for the application.
//

#include "Super_file_base.h"
#include "crow.h"
#include <string.h>
#include <algorithm>
#include <cstdlib>
#include <vector>
#include <cmath>

using namespace std;
string processstrings(string order_commands);
string CALCULATOR(string calc_command);
int NUMBERIFIER(vector<int> numbers_UNFIED);//unfied numbers here 

int main()
{
	crow::SimpleApp app;

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
					res.set_header("Access-Control-Allow-Origin", "*");
					res.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
					res.set_header("Access-Control-Allow-Headers", "Content-Type");
					return res;
				}

				if (req.method == crow::HTTPMethod::GET)
				{
					crow::json::wvalue response;
					response["success"] = true;
					response["message"] = "This is a GET request";
					auto res = crow::response(200, response);
					res.set_header("Access-Control-Allow-Origin", "*");
					return res;
				}
				auto body = crow::json::load(req.body);

				if (!body)
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Invalid JSON";

					auto res = crow::response(400, error);
					res.set_header("Access-Control-Allow-Origin", "*");
					return res;
				}

				if (!body["command"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Missing command";

					auto res = crow::response(400, error);
					res.set_header("Access-Control-Allow-Origin", "*");
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
				res.set_header("Access-Control-Allow-Origin", "*");
				return res;
			});
	//const char* port = std::getenv("PORT");
	//app.port(port ? std::stoi(port) : 8080).multithreaded().run();

	app.port(8080).multithreaded().run();

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
			std::string echo_string = order_commands.substr(4);
			return echo_string;
		}
	}
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
