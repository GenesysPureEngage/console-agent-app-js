const readline = require('readline');
const WorkspaceApi = require('genesys-workspace-client-js');

class WorkspaceConsole {
  constructor(options) {
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this._options = options;

    this._api = new WorkspaceApi(options);
    this._api.on('CallStateChanged', msg => {
      if (msg.previousConnId) {
        this._write(`Call [${msg.previousConnId}] id changed to [${msg.call.id}].`);
      } else {
        this._write(`CallStateChanged: id [${msg.call.id}] state [${msg.call.state}].`);
      }
    });
    this._api.on('DnStateChanged', msg => this._write(
      `DnStateChanged: number [${msg.dn.number}] state [${msg.dn.agentState}]` +
      ` workMode [${msg.dn.agentWorkMode}].`));
  }

  async _prompt() {
    return new Promise((resolve, reject) => {
      let answer = this._rl.question('cmd>', answer => {
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
    this._write('dn');
    this._write('calls');
    this._write('ready|r');
    this._write('not-ready|nr');
    this._write('make-call|mc <destination>');
    this._write('answer|a <id>');
    this._write('hold|h <id>');
    this._write('retrieve|ret <id>');
    this._write('release|rel <id>');
    this._write('initiate-conference|ic <id> <destination>');
    this._write('complete-conference|cc <id> <parentConnId>');
    this._write('initiate-transfer|it <id> <destination>');
    this._write('complete-transfer|ct <id> <parentConnId>');
    this._write('target-search|ts <searchTerm> <limit>');
    this._write('alternate|alt <id> <heldConnId>');
    this._write('clear');
    this._write('config');
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

  async _init() {
    this._write('Initializing api...');
    await this._api.initialize();
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
      if (this._options.autoLogin) {
        this._write('autoLogin is true...');    
        await this._init();
        await this._activateChannels([]);  
      }
    } catch (e) {
      this._log('autoLogin failed!');
      this._log(e);
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
                'agentId: ' + user.agentId || '' + '\n' +
                'defaultPlace: ' + user.defaultPlace || '' + '\n');
            }
            break;

          case 'config': 
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
