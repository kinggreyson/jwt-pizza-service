const config = require('./config');
const os = require('os');

class Metrics {
  constructor() {
    this.http = { total: 0, GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    this.auth = { success: 0, failure: 0 };
    this.pizza = { sold: 0, failures: 0, revenue: 0 };
    this.lastSeen = new Map();
    this.serviceLatency = { total: 0, count: 0 };
    this.pizzaLatency = { total: 0, count: 0 };
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();
    this.http.total++;
    if (this.http[req.method] !== undefined) this.http[req.method]++;

    const token = req.headers.authorization;
    if (token) this.lastSeen.set(token, start);

    res.on('finish', () => {
      this.serviceLatency.total += Date.now() - start;
      this.serviceLatency.count++;
      if (req.method === 'PUT' && req.originalUrl === '/api/auth') {
        res.statusCode === 200 ? this.auth.success++ : this.auth.failure++;
      }
    });
    next();
  };

  pizzaPurchase(success, latencyMs, price) {
    this.pizzaLatency.total += latencyMs;
    this.pizzaLatency.count++;
    if (success) {
      this.pizza.sold++;
      this.pizza.revenue += price;
    } else {
      this.pizza.failures++;
    }
  }

  activeUsers() {
    const cutoff = Date.now() - 5 * 60 * 1000; //Refresh every 5 minutes (converted to milliseconds)
    for (const [token, seen] of this.lastSeen) if (seen < cutoff) this.lastSeen.delete(token); 
    //Remove if user isnt active in last 5 minutes
    return this.lastSeen.size;
  }

  cpu() {
    return Number(((os.loadavg()[0] / os.cpus().length) * 100).toFixed(2));
  }

  memory() {
    const total = os.totalmem();
    return Number((((total - os.freemem()) / total) * 100).toFixed(2));
  }

  avg(l) {
    const v = l.count ? l.total / l.count : 0;
    l.total = 0;
    l.count = 0;
    return v;
  }

  dp(value, attrs = {}) {
    return {
      asDouble: value,
      timeUnixNano: `${Date.now()}000000`, //need to convert to nanoseconds for  for app
      attributes: Object.entries({ source: config.metrics.source, ...attrs }).map(([key, v]) => ({
        key,
        value: { stringValue: String(v) },
      })),
    };
  }

  sum(name, points) {
    return {
      name,
      unit: '1',
      sum: {
        dataPoints: points,
        aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
        isMonotonic: true,
      },
    };
  }

  gauge(name, unit, value) {
    return { name, unit, gauge: { dataPoints: [this.dp(value)] } };
  }

  buildPayload() {
    const metrics = [
        //Sum metrics for increasing values
      this.sum('http_requests', Object.keys(this.http).map((m) => this.dp(this.http[m], { method: m }))),
      this.sum('auth_attempts', [
        this.dp(this.auth.success, { result: 'success' }),
        this.dp(this.auth.failure, { result: 'failure' }),
      ]),
      this.sum('pizzas_sold', [this.dp(this.pizza.sold)]),
      this.sum('pizza_creation_failures', [this.dp(this.pizza.failures)]),
      this.sum('pizza_revenue', [this.dp(this.pizza.revenue)]),
      //Gauge metrics for changing values
      this.gauge('active_users', '1', this.activeUsers()),
      this.gauge('cpu', '%', this.cpu()),
      this.gauge('memory', '%', this.memory()),
      this.gauge('service_latency', 'ms', this.avg(this.serviceLatency)),
      this.gauge('pizza_latency', 'ms', this.avg(this.pizzaLatency)),
    ];
    return { resourceMetrics: [{ scopeMetrics: [{ metrics }] }] };
  }

  async send() {
    const body = JSON.stringify(this.buildPayload());
    try {
      const res = await fetch(config.metrics.endpointUrl, {
        method: 'POST',
        body,
        headers: {
          Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) console.error('Failed to push metrics:', await res.text());
    } catch (err) {
      console.error('Error pushing metrics:', err);
    }
  }

  start(periodMs = 10000) {
    const timer = setInterval(() => this.send(), periodMs);
    timer.unref();
  }
}

const metrics = new Metrics();
metrics.start();
module.exports = metrics;