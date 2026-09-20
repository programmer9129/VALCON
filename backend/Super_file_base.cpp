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
	if (ichy_file_nameworks == "echo")
	{
		echo_mode = true;
		return "LET'S ECHO!, IT WILL BE A FUN I HOPE! ;) . type 'stop echo' to stop echoing.";
	}

	if (ichy_file_nameworks == "echo stop")
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
	if (order_commands == "whoami")
	{
		return "YOU ARE USER... BEEP BEEP ... I AM HAPPY TO WORK WITH YOU :D \n";
		return "I HOPE YOU WILL LIKE ME {^-^}";
	}
	if (order_commands == "help")
	{
		return
			" introduce yourself --> Introduce itself to USER.\n"
			" calculate {your calculation input} --> Calculate The Calculation Input. give the command like 'calculate 5+4=' \n"
			" echo --> echo what the USER says. \n"			
			" mkfile : {name of the file}.txt --> open the file USER want. \n "
			" wrtfile : {name of the file}.txt {context of the file} --> write the txt context into the file you gave \n"
			" rdfile : {name of the file}.txt --> the terminal will show you what in written in the file \n"
			" deltfile : {name of the file}.txt ==> CAREFUL! this command will delete your text file \n"
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

			return BRIDGERequest("create", ichyname);
			return "file:" + ichyname + " has been created";
		}
		else if (ichyname.find(".txt") != string::npos)
		{
			return BRIDGERequest("create", ichyname);
			return "file:" + ichyname + " has been created";
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
		BRIDGERequest("write", NAME_OF_THE_FILES, CONTENT_OF_THE_FILE);
		return "file:" + NAME_OF_THE_FILES + " been updated...";
	}
	if (ichy_file_nameworks.rfind("rdfile : ", 0)==0)
	{
		string ichyname = ichy_file_nameworks.substr(9);

		if (ichyname.find(".txt") == string::npos)
		{
			ichyname += ".txt";
		}
		std::string result_of_read = BRIDGERequest("read", ichyname);
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
	if (ichy_file_nameworks.rfind("deltfile : ",0) == 0)
	{
		string ichyname = ichy_file_nameworks.substr(11);

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

	std::string* response = static_cast<std::string*>(userp);

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
//we need to implement calculate logics here to make sure the calculator works
	//1.st that dont touch this function cuz hour wasted here is miserable and emotionaly damageble
	//hour wasted = 4hr
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
