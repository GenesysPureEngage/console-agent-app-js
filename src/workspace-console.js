const readline = require('readline');
const authorization = require('genesys-authorization-client-js');
const WorkspaceApi = require('genesys-workspace-client-js');
const url = require('url');

class WorkspaceConsole {
  constructor(options) {
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this._options = options;

    this._api = new WorkspaceApi(options.apiKey, options.baseUrl, options.debugEnabled);
    this._api.on('CallStateChanged', msg => {
      if (msg.previousConnId) {
        this._write(`Call [${msg.previousConnId}] id changed to [${msg.call.id}].`);
      } else {
        this._write(`CallStateChanged: id [${msg.call.id}] state [${msg.call.state}].`);
      }
    });
    this._api.on('DnStateChanged', msg => {
      let summary =  `DnStateChanged: number [${msg.dn.number}] state [${msg.dn.agentState}]` +
      ` workMode [${msg.dn.agentWorkMode}]`;
      if (msg.dn.dnd) {
        summary += ' dnd [on]';
      }

      if (msg.dn.forwardTo) {
        summary += ` forwardTo [${msg.dn.forwardTo}]`;
      }
      this._write(summary + '.');
    });
  }

  async _prompt(msg) {
    return new Promise((resolve, reject) => {
      let answer = this._rl.question(msg || 'cmd>', answer => {
        resolve(answer);
      });
    });
  }

  _clear() {
    console.log('\x1Bc');
  }

  _write(msg) {
    console.log(msg);
  }

  _printHelp() {
    this._write('Workspace Api Console commands:');
    this._write('initialize|init|i');
    this._write('destroy|logout|l');
    this._write('activate-channels|ac <agentId> <dn>');
    this._write('user|u');
    this._write('configuration|c');
    this._write('dn');
    this._write('calls');
    this._write('ready|r');
    this._write('not-ready|nr');
    this._write('dnd-on');
    this._write('dnd-off');
    this._write('voice-login');
    this._write('voice-logout');
    this._write('set-forward <destination>');
    this._write('cancel-forward');
    this._write('make-call|mc <destination>');
    this._write('answer|a <id>');
    this._write('hold|h <id>');
    this._write('retrieve|ret <id>');
    this._write('release|rel <id>');
    this._write('clear-call <id>');
    this._write('redirect <id> <destination>');
    this._write('initiate-conference|ic <id> <destination>');
    this._write('complete-conference|cc <id> <parentConnId>');
    this._write('initiate-transfer|it <id> <destination>');
    this._write('complete-transfer|ct <id> <parentConnId>');
    this._write('delete-from-conference|dfc <id> <dnToDrop>');
    this._write('send-dtmf|dtmf <id> <digits>');
    this._write('alternate|alt <id> <heldConnId>');
    this._write('merge <id> <otherConnId>');
    this._write('reconnect <id> <heldConnId>');
    this._write('single-step-transfer|sst <id> <destination>');
    this._write('single-step-conference|ssc <id> <destination>');
    this._write('attach-user-data|aud <id> <key> <value>');
    this._write('update-user-data|uud <id> <key> <value>');
    this._write('delete-user-data-pair|dp <id> <key>');
    this._write('start-recording <id>');
    this._write('pause-recording <id>');
    this._write('resume-recording <id>');
    this._write('stop-recording <id>');
    this._write('send-user-event <key> <value> <callUuid>');
    this._write('target-search|ts <searchTerm> <limit>');
    this._write('clear');
    this._write('console-config');
    this._write('exit|x');
    this._write('debug|d');
    this._write('help|?');
    this._write('');
    this._write('Note: <id> parameter can be omitted for call operations if there is only one active call.');
    this._write('');
  }

  _parseInput(input) {
    if (!input) {
      return { name: null, args: [] };
    }

    let pieces = input.split(' ');
    if (pieces.length === 0) {
      return { name: null, args: []};
    } else if (pieces.length === 1) {
      return { name: pieces[0].toLowerCase(), args: []};
    } else {
      let name = pieces[0].toLowerCase();
      let args = pieces.splice(1);

      return {name, args};
    }
  }

  _getCallId(args) {
    // If we get an id as an argument use that
    if (args.length == 1) {
        return args[0];
    }

    // Otherwise if there is only one call use that id.
    if (this._api.voice.calls.size != 1) {
        return null;
    } else {
        return this._api.voice.calls.values().next().value.id;
    }
  }

  _getCallIdAndParent(args) {
    if (args.length == 2) {
      return { connId: args[0], parentConnId: args[1]};
    }

    // If ids were not provided, see if there is only one 
    // possibility.
    let params = null;
    if (this._api.voice.calls.size == 2) {
      this._api.voice.calls.forEach(c => {
        if (c.parentConnId) {
          params = { connId: c.id, parentConnId: c.parentConnId };
        }
      })
    }

    return params;
  }

  async _getAuthToken() {
    this._write('Getting auth token...');
    let baseUrl = this._options.authBaseUrl || this._options.baseUrl;
    let username = this._options.username || await this._prompt('Username: ');
    let password = this._options.password || await this._prompt('Password: ');
    let clientId = this._options.clientId || await this._prompt('ClientId: ');
    let clientSecret = this._options.clientSecret || await this._prompt('Client Secret: ');

    let client = new authorization.ApiClient();
    client.basePath = `${baseUrl}/auth/v3`;
    if (this._options.apiKey) {
      client.defaultHeaders = { 'x-api-key': this._options.apiKey };
    }
    client.enableCookies = true;

    let authApi = new authorization.AuthenticationApi(client);
    let opts = {
      authorization: "Basic " + new Buffer(`${clientId}:${clientSecret}`).toString("base64"),
      clientId: clientId,
      scope: '*',
      username: username,
      password: password
    };
    
    let response = await authApi.retrieveTokenWithHttpInfo("password", opts);
    return response.data.access_token;
  }

  async _init() {
    let token = await this._getAuthToken();
    if (!token) {
      return;
    }
    this._write('Initializing api...');
    await this._api.initialize({token});
    this._write('Initialization complete.');
  }

  async _destroy() {
    this._write('Logging out and cleaning up...');
    if (this._api.initialized) {
      await this._api.destroy();
    }
  }

  async _doAutoLogin() {
    try {
      if (this._options.autoLogin === 'true') {
        this._write('autoLogin is true...');    
        await this._init();
        await this._activateChannels([]);  
      }
    } catch (e) {
      this._write('autoLogin failed!');
      this._write(e);
    }
  }

  async _activateChannels(args) {
    let hasArgs = args.length == 2;
    if (!hasArgs && (!this._options.defaultAgentId || !this._options.defaultDn)) {
      this._write('Usage: activate-channels <agentId> <dn>');
      return;
    }

    let agentId = hasArgs ? args[0] : this._options.defaultAgentId.toString();
    let dn = hasArgs ? args[1] : this._options.defaultDn.toString();

    this._write(`Sending activate-channels with agentId [${agentId}] and dn [${dn}]...`);
    await this._api.activateChannels(agentId, dn);
  }

  async _makeCall(args) {
    let hasArgs = (args.length > 0);
    if (!hasArgs && !this._options.defaultDestination) {
      this._write('Usage: make-call <destination>');
      return;
    }

    let destination = hasArgs ? args[0] : this._options.defaultDestination.toString();
    this._write(`Sending make-call with destination [${destination}]...`);
    await this._api.voice.makeCall(destination);
  }

  async run() {
    this._write('Workspace Api Console');
    this._write('');    
    
    await this._doAutoLogin();

    for (;;) {
      try {
        let input = await this._prompt();
        let {name, args} = this._parseInput(input);
        if (name === null) {
            continue;
        }

        let id;
        let data;
        let params;
        let destination;

        switch(name) {
          case 'acw':
            await this._api.voice.notReady('AfterCallWork');
            break;

          case 'initialize':
          case 'init':
          case 'i':
            await this._init();
            break;

          case 'debug':
          case 'd':
            this._api.setDebugEnabled(!this._api.isDebugEnabled());
            this._write('Debug enabled: ' + this._api.isDebugEnabled());
            break;

          case 'configuration':
          case 'c':
            if (this._api.configuration) {
              this._write('Configuration:\n' + JSON.stringify(this._api.configuration, null, 2));
            } else {
              this._write('No configuration available (is the API initialized?');
            }
            break;
            
          case 'dn':
            let dn = this._api.voice.dn;
            if (dn) {
              this._write('DN:\n' + JSON.stringify(dn, null , 2));
            } else {
              this._write('<not initialized>');
            }   
            break;

          case 'calls':
            this._write('Calls:');
            if (this._api.voice.calls.size > 0) {
              this._api.voice.calls.forEach(c => {
                if (args.length > 0) {
                  this._write(JSON.stringify(c, null , 2));
                } else {
                  let summary = `Id [${c.id}] state [${c.state}] type [${c.callType}]`;

                  let participants = '';
                  for (let i = 0; i < c.participants.length; i++) {
                    let p = c.participants[i].number;
                    if (participants !== '') { participants += ', '}

                    participants += p;
                  }                  
                  summary += ` participants [${participants}]`;
                  if (c.parentConnId) {
                    summary += ` parent [${c.parentConnId}]`;
                  }
                  this._write(summary);
                }
              });
            } else {
              this._write('<none>');
            }
            break;

          case 'activate-channels':
          case 'ac':
            await this._activateChannels(args);
            break;

          case 'iac':
            await this._init();
            await this._activateChannels(args);
            break; 

          case 'not-ready':
          case 'nr':
            this._write(`Sending not-ready...`);
            await this._api.voice.notReady();
            break;

          case 'ready':
          case 'r':
            this._write(`Sending ready...`);
            await this._api.voice.ready();
            break;

          case 'dnd-on':
            this._write('Sending dnd-on...');
            await this._api.voice.dndOn();
            break;

          case 'dnd-off':
            this._write('Sending dnd-off...');
            await this._api.voice.dndOff();
            break;

          case 'voice-login':
            this._write('Sending voice login...');
            await this._api.voice.login();
            break;

          case 'voice-logout':
            this._write('Sending voice logout...');
            await this._api.voice.logout();
            break;

          case 'set-forward':
            this._write('Sending set-forward...');
            if (args.length < 1) {
              this._write('Usage: set-forward <destination>');
            } else {
              await this._api.voice.setForward(args[0]);
            }
            break;

          case 'cancel-forward':
            this._write('Sending cancel-forward...');
            await this._api.voice.cancelForward();
            break;

          case 'make-call':
          case 'mc':
            await this._makeCall(args); 
            break;

          case 'release':
          case 'rel':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: release <id>');
            } else {
              this._write(`Sending release for call [${id}]...`);
              await this._api.voice.releaseCall(id);
            }
            break;

          case 'clear-call':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: clear-call <id>');
            } else {
              this._write(`Sending clear for call [${id}]...`);
              await this._api.voice.clearCall(id);
            }
            break;

          case 'redirect':
            destination = args[args.length -1];
            id = this._getCallId(args.length == 1 ? [] : args);
            if (!id) {
              this._write('Usage: redirect <id> <destination>');
            } else {
              this._write(`Sending redirect for call [${id}] with destination [${destination}]...`);
              await this._api.voice.redirectCall(id, destination);
            }
            break;

          case 'answer':
          case 'a':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: answer <id>');
            } else {
              this._write(`Sending answer for call [${id}]...`);
              await this._api.voice.answerCall(id);
            }
            break;

          case 'hold':
          case 'h':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: hold <id>');
            } else {
              this._write(`Sending hold for call [${id}]...`);
              await this._api.voice.holdCall(id);
            }
            break;

          case 'retrieve':
          case 'ret':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: retrieve <id>');
            } else {
              this._write(`Sending retrieve for call [${id}]...`);
              await this._api.voice.retrieveCall(id);
            }
            break;

          case 'initiate-conference':
          case 'ic':
            if (args.length < 1) {
              this._write('Usage: initiate-conference <id> <destination>');
            } else {
              // If there is only one argument take it as the destination.
              destination = args[args.length - 1];
              id = this._getCallId(args.length === 1 ? [] : args);
              if (!id) {
                this._write('Usage: initiate-conference <id> <destination>');
              } else {
                this._write(`Sending initiate-conference for call [${id}] and destination [${destination}]...`);
                await this._api.voice.initiateConference(id, destination);
              }
            }
            break;

          case 'complete-conference':
          case 'cc':
            params = this._getCallIdAndParent(args);
            if (!params) {
              this._write('Usage: complete-conference <id> <parentConnId>');
            } else {
              this._write(`Sending complete-conference for call [${params.connId}] and parentConnId [${params.parentConnId}]...`);
              await this._api.voice.completeConference(params.connId, params.parentConnId);
            }
            break;

          case 'delete-from-conference':
          case 'dfc':
            // If there is only one argument, take it as the party
            let dnToDrop = args[args.length -1];
            id = this._getCallId(args.length == 1 ? [] : args);
            if (!id) {
              this._write('Usage: delete-from-conference <id> <dnToDrop');
            } else {
              this._write(`Sending delete-from-conference for call [${id}] with dnToDrop [${dnToDrop}]...`);
              await this._api.voice.deleteFromConference(id, dnToDrop);
            }
            break;


          case 'initiate-transfer':
          case 'it':
            if (args.length < 1) {
              this._write('Usage: initiate-transfer <id> <destination>');
            } else {
              // If there is only one argument take it as the destination.
              destination = args[args.length - 1];
              id = this._getCallId(args.length === 1 ? [] : args);
              if (!id) {
                this._write('Usage: initiate-transfer <id> <destination>');
              } else {
                this._write(`Sending initiate-transfer for call [${id}] and destination [${destination}]...`);
                await this._api.voice.initiateTransfer(id, destination);
              }
            }
            break;

          case 'complete-transfer':
          case 'ct':
            params = this._getCallIdAndParent(args);
            if (!params) {
              this._write('Usage: complete-transfer <id> <parentConnId>');
            } else {
              this._write(`Sending complete-transfer for call [${params.connId}] and parentConnId [${params.parentConnId}]...`);
              await this._api.voice.completeTransfer(params.connId, params.parentConnId);
            }
            break;

          case 'alternate':
          case 'alt':
            if (args.length < 2) {
              this._write('Usage: alternate <id> <heldConnId>');
            } else {
              this._write(`Sending alternate for call [${args[0]}] and heldConnId [${args[1]}]...`);
              await this._api.voice.alternateCalls(args[0], args[1]);
            }
            break;

          case 'merge':
            if (args.length < 2) {
              this._write('Usage: merge <id> <otherConnId>');
            } else {
              this._write(`Sending merge for call [${args[0]}] and otherConnId [${args[1]}]...`);
              await this._api.voice.mergeCalls(args[0], args[1]);
            }
            break;

          case 'reconnect':
            if (args.length < 2) {
              this._write('Usage: reconnect <id> <heldConnId');
            } else {
              this._write(`Sending reconnect for call [${args[0]}] and heldConnId [${args[1]}]...`);
              await this._api.voice.reconnectCall(args[0], args[1]);
            }
            break;

          case 'single-step-transfer':
          case 'sst':
            if (args.length < 1) {
              this._write('Usage: single-step-transfer <id> <destination>');
            } else {
              // If there is only one argument take it as the destination.
              destination = args[args.length - 1];
              id = this._getCallId(args.length === 1 ? [] : args);
              if (!id) {
                this._write('Usage: single-step-transfer <id> <destination>');
              } else {
                this._write(`Sending single-step-transfer for call [${id}] and destination [${destination}]...`);
                await this._api.voice.singleStepTransfer(id, destination);
              }
            }
            break;

          case 'single-step-conference':
          case 'ssc':
            if (args.length < 1) {
              this._write('Usage: single-step-conference <id> <destination>');
            } else {
              // If there is only one argument take it as the destination.
              destination = args[args.length - 1];
              id = this._getCallId(args.length === 1 ? [] : args);
              if (!id) {
                this._write('Usage: single-step-conference <id> <destination>');
              } else {
                this._write(`Sending single-step-conference for call [${id}] and destination [${destination}]...`);
                await this._api.voice.singleStepConference(id, destination);
              }
            }
            break;

          case 'attach-user-data':
          case 'aud':
            id = this._getCallId(args);
            if (!id || args.length < 3) {
              this._write('Usage: attach-user-data <id> <key> <value>');
            } else {
              data = [{
                key: args[1],
                type: 'str',
                value: args[2]
              }];
              this._write(`Sending attach-user-data for call [${id}]...`);
              await this._api.voice.attachUserData(id, data);
            }
            break;

          case 'update-user-data':
          case 'uud':
            id = this._getCallId(args);
            if (!id || args.length < 3) {
              this._write('Usage: update-user-data <id> <key> <value>');
            } else {
              data = [{
                key: args[1],
                type: 'str',
                value: args[2]
              }];
              this._write(`Sending update-user-data for call [${id}]...`);
              await this._api.voice.updateUserData(id, data);
            }
            break;

          case 'delete-user-data-pair':
          case 'dp':
            id = this._getCallId(args);
            if (!id || args.length < 2) {
              this._write('Usage: delete-user-data-pair <id> <key>');
            } else {
              this._write(`Sending delete-user-data-pair for call [${id}]...`);
              await this._api.voice.deleteUserDataPair(id, args[1]);
            }
            break;

          case 'send-dtmf':
          case 'dtmf':
            id = this._getCallId(args);
            if (!id || args.length < 2) {
              this._write('Usage: send-dtmf <id> <digits>');
            } else {
              this._write(`Sending send-dtmf for call [${id}] with dtmfDigits [${args[1]}]...`);
              await this._api.voice.sendDTMF(id, args[1]);
            }
            break;

          case 'start-recording':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: start-recording <id>');
            } else {
              this._write(`Sending start-recording for call [${id}]...`);
              await this._api.voice.startRecording(id);
            }
            break;

          case 'pause-recording':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: pause-recording <id>');
            } else {
              this._write(`Sending pause-recording for call [${id}]...`);
              await this._api.voice.pauseRecording(id);
            }
            break;

          case 'resume-recording':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: resume-recording <id>');
            } else {
              this._write(`Sending resume-recording for call [${id}]...`);
              await this._api.voice.resumeRecording(id);
            }
            break;

          case 'stop-recording':
            id = this._getCallId(args);
            if (!id) {
              this._write('Usage: stop-recording <id>');
            } else {
              this._write(`Sending stop-recording for call [${id}]...`);
              await this._api.voice.stopRecording(id);
            }
            break;

          case 'send-user-event':
            if (args.length < 2) {
              this._write('Usage: send-user-event <key> <value> <callUuid>');
            } else {
              data = [{
                key: args[0],
                type: 'str',
                value: args[1]
              }];
              let uuid = args.length === 3 ? args[2] : null;

              this._write(`Sending send-user-event with data [${JSON.stringify(data)}] and callUuid [${uuid}]...`);
              await this._api.voice.sendUserEvent(data, uuid);
            }
            break;

          case 'target-search':
          case 'ts':
            if (args.length < 1) {
              this._write('Usage: target-search <searchTerm> <limit>');
            } else {
              this._write(`Searching targets with searchTerm [${args[0]}] and limit [${args[1]}]...`);
              let targets = await this._api.targets.search(args[0], args[1]);
              this._write('Search results:\n' + JSON.stringify(targets, null, 2));
            }
            break;

          case 'destroy':
          case 'logout':
          case 'l':
            this._destroy();
            break;

          case 'user':
          case 'u':
            let user = this._api.user;
            if (user) {
              this._write('User details:\n' +
                'employeeId: ' + user.employeeId + '\n' +
                'agentId: ' + user.agentLogin || '' + '\n' +
                'defaultPlace: ' + user.defaultPlace || '' + '\n');
            }
            break;

          case 'console-config': 
            this._write(JSON.stringify(this._options, null, 2));
            break;

          case 'clear':
            this._clear();
            break;

          case 'exit':
          case 'x':
            this._destroy();
            this._rl.close();
            return;

          case '?':
          case 'help':
            this._printHelp();
            break;

          default:
            break;
        }
      } catch (e) {
        this._write('Command failed!');
        this._write(e);
      }
    }
  }
}

module.exports = WorkspaceConsole;
