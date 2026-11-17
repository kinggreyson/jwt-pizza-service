const config = require('./config').logging;
const { AsyncLocalStorage } = require('async_hooks');

class Logger {
  als = new AsyncLocalStorage();

  httpLogger = (req, res, next) => {
    const send = res.send;
    res.send = (resBody) => {
      this.log(this.statusToLogLevel(res.statusCode), 'http', {
        authorized: !!req.headers.authorization,
        user: req.user?.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
      });
      res.send = send;
      return res.send(resBody);
    };
    this.als.run({ req }, next); 
  };

  dbLogger(sql, params) {
    const user = this.als.getStore()?.req?.user?.id;
    this.log('info', 'db', { user, sql, params });
  }

  factoryLogger(user, reqBody, resBody, ok) {
    this.log(ok ? 'info' : 'warn', 'factory', {
      user: user?.id,
      reqBody: JSON.stringify(reqBody),
      resBody: JSON.stringify(resBody),
    });
  }

  unhandledErrorLogger(err) {
    this.log('error', 'unhandledError', { message: err.message, status: err.statusCode, stack: err.stack });
  }

  log(level, type, logData) {
    const labels = { component: config.source, level, type };
    const values = [this.nowString(), this.sanitize(logData)];
    this.sendLogToGrafana({ streams: [{ stream: labels, values: [values] }] });
  }

  statusToLogLevel(s) { return s >= 500 ? 'error' : s >= 400 ? 'warn' : 'info'; }
  nowString() { return (Math.floor(Date.now()) * 1000000).toString(); }

  sanitize(logData) {
    let s = JSON.stringify(logData);
    s = s.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
    s = s.replace(/"password":\s*"[^"]*"/g, '"password": "*****"');
    s = s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '*****'); 
    return s;
  }

  sendLogToGrafana(event) {
    fetch(config.endpointUrl, {
      method: 'post',
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accountId}:${config.apiKey}`,
      },
    }).then(async (res) => {
      if (!res.ok) console.log('Failed to send log to Grafana:', res.status);
    });
  }
}

module.exports = new Logger();