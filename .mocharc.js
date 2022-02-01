module.exports = {
    bail: true, // to fail fast
    require: 'dotenv/config',
    reporter: 'mocha-multi-reporters',
    'reporter-options': 'configFile=reporter.config.json',
    slow: 2000,
    timeout: 1000 * 60 * 10,
  };