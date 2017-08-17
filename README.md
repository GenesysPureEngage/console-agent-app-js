# console-agent-app-js

## Running

You can run the console sample by passing in command line arguments as shown in this example:<br>
`node src/app.js --apiKey=<key> --clientId=<clientId> --clientSecret=<secret> --baseUrl=<url> --username=<user> --password=<p> --debugEnabled=<true or false> --defaultAgentId=<optional> --defaultDn=<optional> --defaultDestination=<optional>`



## Commands

| Command          | Aliases           | Arguments   | Description |
| -------------    |:-----------------:| ----------: |------------------------------ |
| initialize       | init, i           |             | initialize the API using the arguments provided at startup                      |
| destroy          | logout, l         |             | logout and cleanup                      |
| activate-channels | ac                | agentId, dn | activate the voice channel using the provided resources             |
| user             | u                 |             | print information about the user                      |
| dn               |                   |             | print the current state of the dn                      |
| calls            |                   |             | print the list of active calls                      |
| ready            | r                 |             | set agent state to ready                      |
| not-ready        | nr                |             | set agent state to notready                      |
| make-call        | mc                | destination | make a call to the specified destination. If not provided the default destination will be used.                      |
| answer           | a                 | id          | answer the specified call (*)                       |
| hold             | h                 | id          | place the specified call on hold. (*)                   |
| retrieve         | ret               | id          | retrieve the specified call (*)                      |
| release          | rel               | id          | release the specified call (*)                      |
| initiate-conference              |ic                   |id, destination            | initiate a conference to the specified destination                      |
| complete-conference              |cc                 |id, parentConnId             | complete a conference (**)                  |
| initiate-transfer              |it                   |id, destination            | initiate a transfer to the specified destination                      |
| complete-transfer              |ct                   |id, parentConnId             | complete a transfer (**)                    |
| alternate              |alt                   |id, heldConnId            | alternate calls                      |
| target-search              |ts                   |searchTerm, limit            | search for targets using the specified search term                      |
| clear              |                   |            | clear the output window                      |
| config              |                   |            | print the console config                      |
| exit              |x                   |            | logout if necessary then exit                      |
| debug              |d                  |            | toggle debug output                      |
| help              |?                   |            | print the list of available commands                      |

(*) - if there is only one active call the id parameter can be omitted.<br>
(**) - if there are only two active calls both id and parentId parameters can be omitted.


