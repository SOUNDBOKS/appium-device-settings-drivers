import * as child_process from "child_process"

export type AppiumProcess = child_process.ChildProcess

export const startServer = (logPath: string, port: number): child_process.ChildProcess => {
  const logLevelConsole = 'error';
  const logLevelFile = 'debug';
  console.info("Starting appium subprocess in cwd: " + process.cwd())
  const appiumServer = child_process.spawn("yarn", [
    "appium",
    '--relaxed-security',
    `--port=${port}`,
    `--log=${logPath}`,
    `--log-level=${logLevelConsole}:${logLevelFile}`,
  ], {
    stdio: "inherit"
  })
  return appiumServer;
}

export const stopServer = async (server: child_process.ChildProcess) => {
  if (server) {
    server.kill("SIGTERM")
    await new Promise((resolve) => setTimeout(resolve, 3000));
    server.connected? server.kill("SIGKILL") : null
  }
}
