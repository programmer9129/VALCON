// Super_file_base.cpp : Defines the entry point for the application.
//

#include "Super_file_base.h"
#include "crow.h"
#include <string.h>
#include <algorithm>

using namespace std;
string processstrings(string order_commands);

int main()
{
	crow::SimpleApp app;

	CROW_ROUTE(app, "/")([]
	{
		return "Hello, World!";
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
	app.port(8080).multithreaded().run();

}
string processstrings(string order_commands)
{
	
	order_commands.erase(remove(order_commands.begin(), order_commands.end(), ' '), order_commands.end());
	if (order_commands == "help")
	{
		return
			" who am i --> says who are you \n"
			" calc --> calculate the calculation \n"
			" echo --> echo what the user says \n"
			" introduce yourself --> introduce itself to you...\n";
	}
	if (order_commands == "whoami")
	{
		return
			" Hi!, I am Valcon .A Web CLI Application, I can do much things. \n"
			" to be continued \n";
	}
}

