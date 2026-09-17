// Super_file_base.cpp : Defines the entry point for the application.
//

#include "Super_file_base.h"
#include "crow.h"
#include <string.h>

using namespace std;

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

				response["success"] = true;
				response["output"] = "C++ crow server is on hot action buddy" + command;

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

