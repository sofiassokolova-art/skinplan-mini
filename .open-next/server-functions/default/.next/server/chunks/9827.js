"use strict";exports.id=9827,exports.ids=[9827],exports.modules={49827:(a,b,c)=>{var d=Object.defineProperty,e=Object.getOwnPropertyDescriptor,f=Object.getOwnPropertyNames,g=Object.prototype.hasOwnProperty,h=(a,b)=>{for(var c in b)d(a,c,{get:b[c],enumerable:!0})},i={};h(i,{Analytics:()=>k,IpDenyList:()=>x,MultiRegionRatelimit:()=>G,Ratelimit:()=>H}),a.exports=((a,b,c)=>{if(b&&"object"==typeof b||"function"==typeof b)for(let h of f(b))g.call(a,h)||void 0===h||d(a,h,{get:()=>b[h],enumerable:!(c=e(b,h))||c.enumerable});return a})(d({},"__esModule",{value:!0}),i);var j=c(71652),k=class{analytics;table="events";constructor(a){this.analytics=new j.Analytics({redis:a.redis,window:"1h",prefix:a.prefix??"@upstash/ratelimit",retention:"90d"})}extractGeo(a){return void 0!==a.geo?a.geo:void 0!==a.cf?a.cf:{}}async record(a){await this.analytics.ingest(this.table,a)}async series(a,b){let c=Math.min((this.analytics.getBucket(Date.now())-this.analytics.getBucket(b))/36e5,256);return this.analytics.aggregateBucketsWithPipeline(this.table,a,c)}async getUsage(a=0){let b=Math.min((this.analytics.getBucket(Date.now())-this.analytics.getBucket(a))/36e5,256);return await this.analytics.getAllowedBlocked(this.table,b)}async getUsageOverTime(a,b){return await this.analytics.aggregateBucketsWithPipeline(this.table,b,a)}async getMostAllowedBlocked(a,b,c){return b=b??5,this.analytics.getMostAllowedBlocked(this.table,a,b,void 0,c)}},l=class{cache;constructor(a){this.cache=a}isBlocked(a){if(!this.cache.has(a))return{blocked:!1,reset:0};let b=this.cache.get(a);return b<Date.now()?(this.cache.delete(a),{blocked:!1,reset:0}):{blocked:!0,reset:b}}blockUntil(a,b){this.cache.set(a,b)}set(a,b){this.cache.set(a,b)}get(a){return this.cache.get(a)||null}incr(a,b=1){let c=this.cache.get(a)??0;return c+=b,this.cache.set(a,c),c}pop(a){this.cache.delete(a)}empty(){this.cache.clear()}size(){return this.cache.size}},m=":dynamic:global",n="@upstash/ratelimit";function o(a){let b=a.match(/^(\d+)\s?(ms|s|m|h|d)$/);if(!b)throw Error(`Unable to parse window size: ${a}`);let c=Number.parseInt(b[1]);switch(b[2]){case"ms":return c;case"s":return 1e3*c;case"m":return 1e3*c*60;case"h":return 1e3*c*3600;case"d":return 1e3*c*86400;default:throw Error(`Unable to parse window size: ${a}`)}}var p=async(a,b,c,d)=>{try{return await a.redis.evalsha(b.hash,c,d)}catch(e){if(`${e}`.includes("NOSCRIPT"))return await a.redis.eval(b.script,c,d);throw e}},q={fixedWindow:{limit:{script:`
  local key           = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens        = tonumber(ARGV[1])  -- default limit
  local window        = ARGV[2]
  local incrementBy   = ARGV[3] -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return {r, effectiveLimit}
`,hash:"472e55443b62f60d0991028456c57815a387066d"},getRemaining:{script:`
  local key = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens = tonumber(ARGV[1])  -- default limit

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local value = redis.call('GET', key)
  local usedTokens = 0
  if value then
    usedTokens = tonumber(value)
  end
  
  return {effectiveLimit - usedTokens, effectiveLimit}
`,hash:"40515c9dd0a08f8584f5f9b593935f6a87c1c1c3"}},slidingWindow:{limit:{script:`
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = tonumber(ARGV[4]) -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  -- Only check limit if not refunding (negative rate)
  if incrementBy > 0 and requestsInPreviousWindow + requestsInCurrentWindow >= effectiveLimit then
    return {-1, effectiveLimit}
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == incrementBy then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return {effectiveLimit - ( newValue + requestsInPreviousWindow ), effectiveLimit}
`,hash:"977fb636fb5ceb7e98a96d1b3a1272ba018efdae"},getRemaining:{script:`
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  local usedTokens = requestsInPreviousWindow + requestsInCurrentWindow
  return {effectiveLimit - usedTokens, effectiveLimit}
`,hash:"ee3a3265fad822f83acad23f8a1e2f5c0b156b03"}},tokenBucket:{limit:{script:`
  local key         = KEYS[1]           -- identifier including prefixes
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = effectiveLimit
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(effectiveLimit, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  -- Only reject if tokens are 0 and we're consuming (not refunding)
  if tokens == 0 and incrementBy > 0 then
    return {-1, refilledAt + interval, effectiveLimit}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((effectiveLimit - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

  if (expireAt > 0) then
    redis.call("PEXPIRE", key, expireAt)
  end
  return {remaining, refilledAt + interval, effectiveLimit}
`,hash:"b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89"},getRemaining:{script:`
  local key         = KEYS[1]
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {effectiveLimit, -1, effectiveLimit}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1]), effectiveLimit}
`,hash:"deb03663e8af5a968deee895dd081be553d2611b"}},cachedFixedWindow:{limit:{script:`
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`,hash:"c26b12703dd137939b9a69a3a9b18e906a2d940f"},getRemaining:{script:`
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`,hash:"8e8f222ccae68b595ee6e3f3bf2199629a62b91a"}}},r={fixedWindow:{limit:{script:`
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`,hash:"a8c14f3835aa87bd70e5e2116081b81664abcf5c"},getRemaining:{script:`
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `,hash:"8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd"}},slidingWindow:{limit:{script:`
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window

	-- Only check limit if not refunding (negative rate)
	if incrementBy > 0 and requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow + incrementBy > tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`,hash:"1e7ca8dcd2d600a6d0124a67a57ea225ed62921b"},getRemaining:{script:`
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`,hash:"558c9306b7ec54abb50747fe0b17e5d44bd24868"}}},s={script:`
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `,hash:"54bd274ddc59fb3be0f42deee2f64322a10e2b50"},t="denyList",u="ipDenyList",v="ipDenyListStatus",w=`
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`,x={};h(x,{ThresholdError:()=>y,disableIpDenyList:()=>B,updateIpDenyList:()=>A});var y=class extends Error{constructor(a){super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${a}`),this.name="ThresholdError"}},z=async a=>{if("number"!=typeof a||a<1||a>8)throw new y(a);try{let b=await fetch(`https://raw.githubusercontent.com/stamparm/ipsum/master/levels/${a}.txt`);if(!b.ok)throw Error(`Error fetching data: ${b.statusText}`);return(await b.text()).split("\n").filter(a=>a.length>0)}catch(a){throw Error(`Failed to fetch ip deny list: ${a}`)}},A=async(a,b,c,d)=>{let e=await z(c),f=[b,t,"all"].join(":"),g=[b,t,u].join(":"),h=[b,v].join(":"),i=a.multi();return i.sdiffstore(f,f,g),i.del(g),i.sadd(g,e.at(0),...e.slice(1)),i.sdiffstore(g,g,f),i.sunionstore(f,f,g),i.set(h,"valid",{px:d??864e5-(Date.now()-72e5)%864e5}),await i.exec()},B=async(a,b)=>{let c=[b,t,"all"].join(":"),d=[b,t,u].join(":"),e=[b,v].join(":"),f=a.multi();return f.sdiffstore(c,c,d),f.del(d),f.set(e,"disabled"),await f.exec()},C=new l(new Map),D=async(a,b,c)=>{let d,[e,f]=await a.eval(w,[[b,t,"all"].join(":"),[b,v].join(":")],c);return e.map((a,b)=>{if(a){var e;e=c[b],C.size()>1e3&&C.empty(),C.blockUntil(e,Date.now()+6e4),d=c[b]}}),{deniedValue:d,invalidIpDenyList:-2===f}},E=class{limiter;ctx;prefix;timeout;primaryRedis;analytics;enableProtection;denyListThreshold;dynamicLimits;constructor(a){this.ctx=a.ctx,this.limiter=a.limiter,this.timeout=a.timeout??5e3,this.prefix=a.prefix??n,this.dynamicLimits=a.dynamicLimits??!1,this.enableProtection=a.enableProtection??!1,this.denyListThreshold=a.denyListThreshold??6,this.primaryRedis="redis"in this.ctx?this.ctx.redis:this.ctx.regionContexts[0].redis,"redis"in this.ctx&&(this.ctx.dynamicLimits=this.dynamicLimits,this.ctx.prefix=this.prefix),this.analytics=a.analytics?new k({redis:this.primaryRedis,prefix:this.prefix}):void 0,a.ephemeralCache instanceof Map?this.ctx.cache=new l(a.ephemeralCache):void 0===a.ephemeralCache&&(this.ctx.cache=new l(new Map))}limit=async(a,b)=>{let c=null;try{let d=this.getRatelimitResponse(a,b),{responseArray:e,newTimeoutId:f}=this.applyTimeout(d);c=f;let g=await Promise.race(e);return this.submitAnalytics(g,a,b)}finally{c&&clearTimeout(c)}};blockUntilReady=async(a,b)=>{let c;if(b<=0)throw Error("timeout must be positive");let d=Date.now()+b;for(;!(c=await this.limit(a)).success;){if(0===c.reset)throw Error("This should not happen");let a=Math.min(c.reset,d)-Date.now();if(await new Promise(b=>setTimeout(b,a)),Date.now()>d)break}return c};resetUsedTokens=async a=>{let b=[this.prefix,a].join(":");await this.limiter().resetTokens(this.ctx,b)};getRemaining=async a=>{let b=[this.prefix,a].join(":");return await this.limiter().getRemaining(this.ctx,b)};getRatelimitResponse=async(a,b)=>{let c=this.getKey(a),d=this.getDefinedMembers(a,b),e=d.find(a=>C.isBlocked(a).blocked),f=e?[{success:!1,limit:0,remaining:0,reset:0,pending:Promise.resolve(),reason:"denyList",deniedValue:e},{deniedValue:e,invalidIpDenyList:!1}]:await Promise.all([this.limiter().limit(this.ctx,c,b?.rate),this.enableProtection?D(this.primaryRedis,this.prefix,d):{deniedValue:void 0,invalidIpDenyList:!1}]);return((a,b,[c,d],e)=>{if(d.deniedValue&&(c.success=!1,c.remaining=0,c.reason="denyList",c.deniedValue=d.deniedValue),d.invalidIpDenyList){let d=A(a,b,e);c.pending=Promise.all([c.pending,d])}return c})(this.primaryRedis,this.prefix,f,this.denyListThreshold)};applyTimeout=a=>{let b=null,c=[a];if(this.timeout>0){let a=new Promise(a=>{b=setTimeout(()=>{a({success:!0,limit:0,remaining:0,reset:0,pending:Promise.resolve(),reason:"timeout"})},this.timeout)});c.push(a)}return{responseArray:c,newTimeoutId:b}};submitAnalytics=(a,b,c)=>{if(this.analytics)try{let d=c?this.analytics.extractGeo(c):void 0,e=this.analytics.record({identifier:"denyList"===a.reason?a.deniedValue:b,time:Date.now(),success:"denyList"===a.reason?"denied":a.success,...d}).catch(a=>{let b="Failed to record analytics";`${a}`.includes("WRONGTYPE")&&(b=`
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `),console.warn(b,a)});a.pending=Promise.all([a.pending,e])}catch(a){console.warn("Failed to record analytics",a)}return a};getKey=a=>[this.prefix,a].join(":");getDefinedMembers=(a,b)=>[a,b?.ip,b?.userAgent,b?.country].filter(Boolean);setDynamicLimit=async a=>{if(!this.dynamicLimits)throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use setDynamicLimit()");let b=`${this.prefix}${m}`;await (!1===a.limit?this.primaryRedis.del(b):this.primaryRedis.set(b,a.limit))};getDynamicLimit=async()=>{if(!this.dynamicLimits)throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use getDynamicLimit()");let a=`${this.prefix}${m}`,b=await this.primaryRedis.get(a);return{dynamicLimit:null===b?null:Number(b)}}};function F(){let a="",b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",c=b.length;for(let d=0;d<16;d++)a+=b.charAt(Math.floor(Math.random()*c));return a}var G=class extends E{constructor(a){super({prefix:a.prefix,limiter:a.limiter,timeout:a.timeout,analytics:a.analytics,dynamicLimits:a.dynamicLimits,ctx:{regionContexts:a.redis.map(b=>({redis:b,prefix:a.prefix??n})),cache:a.ephemeralCache?new l(a.ephemeralCache):void 0}}),a.dynamicLimits&&console.warn("Warning: Dynamic limits are not yet supported for multi-region rate limiters. The dynamicLimits option will be ignored.")}static fixedWindow(a,b){let c=o(b);return()=>({async limit(b,d,e){let f=F(),g=Math.floor(Date.now()/c),h=[d,g].join(":"),i=e??1;if(b.cache&&i>0){let{blocked:c,reset:e}=b.cache.isBlocked(d);if(c)return{success:!1,limit:a,remaining:0,reset:e,pending:Promise.resolve(),reason:"cacheBlock"}}let j=b.regionContexts.map(a=>({redis:a.redis,request:p(a,r.fixedWindow.limit,[h],[f,c,i])})),k=a-(await Promise.any(j.map(a=>a.request))).reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0);async function l(){let b=[...new Set((await Promise.all(j.map(a=>a.request))).flat().reduce((a,b,c)=>(c%2==0&&a.push(b),a),[])).values()];for(let c of j){let d=(await c.request).reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0),e=(await c.request).reduce((a,b,c)=>(c%2==0&&a.push(b),a),[]);if(d>=a)continue;let f=b.filter(a=>!e.includes(a));if(0!==f.length)for(let a of f)await c.redis.hset(h,{[a]:i})}}let m=k>=0,n=(g+1)*c;return b.cache&&(m?i<0&&b.cache.pop(d):b.cache.blockUntil(d,n)),{success:m,limit:a,remaining:k,reset:n,pending:l()}},async getRemaining(b,d){let e=Math.floor(Date.now()/c),f=[d,e].join(":"),g=b.regionContexts.map(a=>({redis:a.redis,request:p(a,r.fixedWindow.getRemaining,[f],[null])}));return{remaining:Math.max(0,a-(await Promise.any(g.map(a=>a.request))).reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0)),reset:(e+1)*c,limit:a}},async resetTokens(a,b){let c=[b,"*"].join(":");a.cache&&a.cache.pop(b),await Promise.all(a.regionContexts.map(a=>{p(a,s,[c],[null])}))}})}static slidingWindow(a,b){let c=o(b),d=o(b);return()=>({async limit(b,e,f){let g=F(),h=Date.now(),i=Math.floor(h/c),j=[e,i].join(":"),k=[e,i-1].join(":"),l=f??1;if(b.cache&&l>0){let{blocked:c,reset:d}=b.cache.isBlocked(e);if(c)return{success:!1,limit:a,remaining:0,reset:d,pending:Promise.resolve(),reason:"cacheBlock"}}let m=b.regionContexts.map(b=>({redis:b.redis,request:p(b,r.slidingWindow.limit,[j,k],[a,h,d,g,l])})),n=h%d/d,[o,q,s]=await Promise.any(m.map(a=>a.request));s&&o.push(g,l.toString());let t=a-(Math.ceil(q.reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0)*(1-n))+o.reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0));async function u(){let b=[...new Set((await Promise.all(m.map(a=>a.request))).flatMap(([a])=>a).reduce((a,b,c)=>(c%2==0&&a.push(b),a),[])).values()];for(let c of m){let[d,e,f]=await c.request,g=d.reduce((a,b,c)=>(c%2==0&&a.push(b),a),[]);if(d.reduce((a,b,c)=>{let d=0;return c%2&&(d=Number.parseInt(b)),a+d},0)>=a)continue;let h=b.filter(a=>!g.includes(a));if(0!==h.length)for(let a of h)await c.redis.hset(j,{[a]:l})}}let v=(i+1)*d;return b.cache&&(s?l<0&&b.cache.pop(e):b.cache.blockUntil(e,v)),{success:!!s,limit:a,remaining:Math.max(0,t),reset:v,pending:u()}},async getRemaining(b,d){let e=Date.now(),f=Math.floor(e/c),g=[d,f].join(":"),h=[d,f-1].join(":"),i=b.regionContexts.map(a=>({redis:a.redis,request:p(a,r.slidingWindow.getRemaining,[g,h],[e,c])}));return{remaining:Math.max(0,a-await Promise.any(i.map(a=>a.request))),reset:(f+1)*c,limit:a}},async resetTokens(a,b){let c=[b,"*"].join(":");a.cache&&a.cache.pop(b),await Promise.all(a.regionContexts.map(a=>{p(a,s,[c],[null])}))}})}},H=class extends E{constructor(a){super({prefix:a.prefix,limiter:a.limiter,timeout:a.timeout,analytics:a.analytics,ctx:{redis:a.redis,prefix:a.prefix??n},ephemeralCache:a.ephemeralCache,enableProtection:a.enableProtection,denyListThreshold:a.denyListThreshold,dynamicLimits:a.dynamicLimits})}static fixedWindow(a,b){let c=o(b);return()=>({async limit(b,d,e){let f=Math.floor(Date.now()/c),g=[d,f].join(":"),h=e??1;if(b.cache&&h>0){let{blocked:c,reset:e}=b.cache.isBlocked(d);if(c)return{success:!1,limit:a,remaining:0,reset:e,pending:Promise.resolve(),reason:"cacheBlock"}}let i=b.dynamicLimits?`${b.prefix}${m}`:"",[j,k]=await p(b,q.fixedWindow.limit,[g,i],[a,c,h]),l=j<=k,n=Math.max(0,k-j),o=(f+1)*c;return b.cache&&(l?h<0&&b.cache.pop(d):b.cache.blockUntil(d,o)),{success:l,limit:k,remaining:n,reset:o,pending:Promise.resolve()}},async getRemaining(b,d){let e=Math.floor(Date.now()/c),f=[d,e].join(":"),g=b.dynamicLimits?`${b.prefix}${m}`:"",[h,i]=await p(b,q.fixedWindow.getRemaining,[f,g],[a]);return{remaining:Math.max(0,h),reset:(e+1)*c,limit:i}},async resetTokens(a,b){let c=[b,"*"].join(":");a.cache&&a.cache.pop(b),await p(a,s,[c],[null])}})}static slidingWindow(a,b){let c=o(b);return()=>({async limit(b,d,e){let f=Date.now(),g=Math.floor(f/c),h=[d,g].join(":"),i=[d,g-1].join(":"),j=e??1;if(b.cache&&j>0){let{blocked:c,reset:e}=b.cache.isBlocked(d);if(c)return{success:!1,limit:a,remaining:0,reset:e,pending:Promise.resolve(),reason:"cacheBlock"}}let k=b.dynamicLimits?`${b.prefix}${m}`:"",[l,n]=await p(b,q.slidingWindow.limit,[h,i,k],[a,f,c,j]),o=l>=0,r=(g+1)*c;return b.cache&&(o?j<0&&b.cache.pop(d):b.cache.blockUntil(d,r)),{success:o,limit:n,remaining:Math.max(0,l),reset:r,pending:Promise.resolve()}},async getRemaining(b,d){let e=Date.now(),f=Math.floor(e/c),g=[d,f].join(":"),h=[d,f-1].join(":"),i=b.dynamicLimits?`${b.prefix}${m}`:"",[j,k]=await p(b,q.slidingWindow.getRemaining,[g,h,i],[a,e,c]);return{remaining:Math.max(0,j),reset:(f+1)*c,limit:k}},async resetTokens(a,b){let c=[b,"*"].join(":");a.cache&&a.cache.pop(b),await p(a,s,[c],[null])}})}static tokenBucket(a,b,c){let d=o(b);return()=>({async limit(b,e,f){let g=Date.now(),h=f??1;if(b.cache&&h>0){let{blocked:a,reset:d}=b.cache.isBlocked(e);if(a)return{success:!1,limit:c,remaining:0,reset:d,pending:Promise.resolve(),reason:"cacheBlock"}}let i=b.dynamicLimits?`${b.prefix}${m}`:"",[j,k,l]=await p(b,q.tokenBucket.limit,[e,i],[c,d,a,g,h]),n=j>=0;return b.cache&&(n?h<0&&b.cache.pop(e):b.cache.blockUntil(e,k)),{success:n,limit:l,remaining:Math.max(0,j),reset:k,pending:Promise.resolve()}},async getRemaining(a,b){let e=a.dynamicLimits?`${a.prefix}${m}`:"",[f,g,h]=await p(a,q.tokenBucket.getRemaining,[b,e],[c]),i=Date.now()+d,j=g+d;return{remaining:Math.max(0,f),reset:-1===g?i:j,limit:h}},async resetTokens(a,b){a.cache&&a.cache.pop(b),await p(a,s,[b],[null])}})}static cachedFixedWindow(a,b){let c=o(b);return()=>({async limit(b,d,e){if(!b.cache)throw Error("This algorithm requires a cache");b.dynamicLimits&&console.warn("Warning: Dynamic limits are not yet supported for cachedFixedWindow algorithm. The dynamicLimits option will be ignored.");let f=Math.floor(Date.now()/c),g=[d,f].join(":"),h=(f+1)*c,i=e??1;if("number"==typeof b.cache.get(g)){let d=b.cache.incr(g,i),e=d<a,f=e?p(b,q.cachedFixedWindow.limit,[g],[c,i]):Promise.resolve();return{success:e,limit:a,remaining:a-d,reset:h,pending:f}}let j=await p(b,q.cachedFixedWindow.limit,[g],[c,i]);b.cache.set(g,j);let k=a-j;return{success:k>=0,limit:a,remaining:k,reset:h,pending:Promise.resolve()}},async getRemaining(b,d){if(!b.cache)throw Error("This algorithm requires a cache");let e=Math.floor(Date.now()/c),f=[d,e].join(":");return"number"==typeof b.cache.get(f)?{remaining:Math.max(0,a-(b.cache.get(f)??0)),reset:(e+1)*c,limit:a}:{remaining:Math.max(0,a-await p(b,q.cachedFixedWindow.getRemaining,[f],[null])),reset:(e+1)*c,limit:a}},async resetTokens(a,b){if(!a.cache)throw Error("This algorithm requires a cache");let d=[b,Math.floor(Date.now()/c)].join(":");a.cache.pop(d);let e=[b,"*"].join(":");await p(a,s,[e],[null])}})}}},71652:a=>{var b=Object.defineProperty,c=Object.getOwnPropertyDescriptor,d=Object.getOwnPropertyNames,e=Object.prototype.hasOwnProperty,f={},g={Analytics:()=>l};for(var h in g)b(f,h,{get:g[h],enumerable:!0});a.exports=((a,f,g)=>{if(f&&"object"==typeof f||"function"==typeof f)for(let h of d(f))e.call(a,h)||void 0===h||b(a,h,{get:()=>f[h],enumerable:!(g=c(f,h))||g.enumerable});return a})(b({},"__esModule",{value:!0}),f);var i=`
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`,j=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`,k=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`,l=class{redis;prefix;bucketSize;constructor(a){this.redis=a.redis,this.prefix=a.prefix??"@upstash/analytics",this.bucketSize=this.parseWindow(a.window)}validateTableName(a){if(!/^[a-zA-Z0-9_-]+$/.test(a))throw Error(`Invalid table name: ${a}. Table names can only contain letters, numbers, dashes and underscores.`)}parseWindow(a){if("number"==typeof a){if(a<=0)throw Error(`Invalid window: ${a}`);return a}let b=/^(\d+)([smhd])$/;if(!b.test(a))throw Error(`Invalid window: ${a}`);let[,c,d]=a.match(b),e=parseInt(c);switch(d){case"s":return 1e3*e;case"m":return 1e3*e*60;case"h":return 1e3*e*3600;case"d":return 1e3*e*86400;default:throw Error(`Invalid window unit: ${d}`)}}getBucket(a){return Math.floor((a??Date.now())/this.bucketSize)*this.bucketSize}async ingest(a,...b){this.validateTableName(a),await Promise.all(b.map(async b=>{let c=this.getBucket(b.time),d=[this.prefix,a,c].join(":");await this.redis.zincrby(d,1,JSON.stringify({...b,time:void 0}))}))}formatBucketAggregate(a,b,c){let d={};return a.forEach(([a,c])=>{"success"==b&&(a=1===a?"true":null===a?"false":a),d[b]=d[b]||{},d[b][(a??"null").toString()]=c}),{time:c,...d}}async aggregateBucket(a,b,c){this.validateTableName(a);let d=this.getBucket(c),e=[this.prefix,a,d].join(":"),f=await this.redis.eval(i,[e],[b]);return this.formatBucketAggregate(f,b,d)}async aggregateBuckets(a,b,c,d){this.validateTableName(a);let e=this.getBucket(d),f=[];for(let d=0;d<c;d+=1)f.push(this.aggregateBucket(a,b,e)),e-=this.bucketSize;return Promise.all(f)}async aggregateBucketsWithPipeline(a,b,c,d,e){this.validateTableName(a),e=e??48;let f=this.getBucket(d),g=[],h=this.redis.pipeline(),j=[];for(let d=1;d<=c;d+=1){let k=[this.prefix,a,f].join(":");h.eval(i,[k],[b]),g.push(f),f-=this.bucketSize,(d%e==0||d==c)&&(j.push(h.exec()),h=this.redis.pipeline())}return(await Promise.all(j)).flat().map((a,c)=>this.formatBucketAggregate(a,b,g[c]))}async getAllowedBlocked(a,b,c){this.validateTableName(a);let d=[this.prefix,a].join(":"),e=this.getBucket(c),f=await this.redis.eval(k,[d],[e,this.bucketSize,b]),g={};for(let a=0;a<f.length;a+=2){let b=f[a],c=b.identifier,d=+f[a+1];g[c]||(g[c]={success:0,blocked:0}),g[c][b.success?"success":"blocked"]=d}return g}async getMostAllowedBlocked(a,b,c,d,e){this.validateTableName(a);let f=[this.prefix,a].join(":"),g=this.getBucket(d),[h,i,k]=await this.redis.eval(j,[f],[g,this.bucketSize,b,c,e??5*c]);return{allowed:this.toDicts(h),ratelimited:this.toDicts(i),denied:this.toDicts(k)}}toDicts(a){let b=[];for(let c=0;c<a.length;c+=1){let d=+a[c][0],e=a[c][1];b.push({identifier:e.identifier,count:d})}return b}}}};