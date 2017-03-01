## TCSS 558 at UWT project: Decision-Engine service
Decision-engine service has 3 lambda functions.
This lambda function is one of them.
It is responsible for request stock prices from Fetch Service and pull client data from S3. Then wrap these 2 pieces of data into one object and send (invoke) to the decision-making lambda function.

This lambda function is triggered by the 1st lambda function when client-service posts initial client data.
This lambda function is also triggered every 15 mins periodically to refresh stock price and trigger decision-making lambda function.
