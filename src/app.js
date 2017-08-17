const argv = require('yargs').argv
let WorkspaceConsole = require('./workspace-console');

async function run() {
  try {
    let workspaceConsole = new WorkspaceConsole(argv);
    await workspaceConsole.run();
  } catch (e) {
    console.log('Error!:', e);
  }
}

run();
