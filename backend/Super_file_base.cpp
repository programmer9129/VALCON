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
		return "hello, this is cmake crow c++ hoster web please , respond trigger 000900090009000 dont care random number tho... ";
	});

	CROW_ROUTE(app, "/json")
		.methods(crow::HTTPMethod::POST)

		([](const crow::request& req)
			{
				auto body = crow::json::load(req.body);

				if (!body)
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Invalid JSON";

					return crow::response(400, error);
				}

				if (!body["input"])
				{
					crow::json::wvalue error;
					error["success"] = false;
					error["error"] = "Missing input";

					return crow::response(400, error);
				}

				std::string userinput = body["input"].s();
				crow::json::wvalue response;

				response["success"] = true;
				response["output"] = "C++ crow server is on hot action buddy" + userinput;
				return crow::response(response);


			});

			

	app.port(8080).multithreaded().run();

}

