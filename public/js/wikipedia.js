function isCompatible(ua) {
    return !!((function() {
        'use strict';
        return !this && Function.prototype.bind && window.JSON;
    }()) && 'querySelector' in document && 'localStorage' in window && 'addEventListener' in window && !ua.match(/MSIE 10|NetFront|Opera Mini|S40OviBrowser|MeeGo|Android.+Glass|^Mozilla\/5\.0 .+ Gecko\/$|googleweblight|PLAYSTATION|PlayStation/));
}
if (!isCompatible(navigator.userAgent)) {
    document.documentElement.className = document.documentElement.className.replace(/(^|\s)client-js(\s|$)/, '$1client-nojs$2');
    while (window.NORLQ && NORLQ[0]) {
        NORLQ.shift()();
    }
    NORLQ = {
        push: function(fn) {
            fn();
        }
    };
    RLQ = {
        push: function() {}
    };
} else {
    if (window.performance && performance.mark) {
        performance.mark('mwStartup');
    }(function() {
        'use strict';
        var mw, StringSet, log, hasOwn = Object.hasOwnProperty,
            console = window.console;

        function fnv132(str) {
            var hash = 0x811C9DC5,
                i = 0;
            for (; i < str.length; i++) {
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
                hash ^= str.charCodeAt(i);
            }
            hash = (hash >>> 0).toString(36).slice(0, 5);
            while (hash.length < 5) {
                hash =
                    '0' + hash;
            }
            return hash;
        }

        function defineFallbacks() {
            StringSet = window.Set || function() {
                var set = Object.create(null);
                return {
                    add: function(value) {
                        set[value] = !0;
                    },
                    has: function(value) {
                        return value in set;
                    }
                };
            };
        }

        function setGlobalMapValue(map, key, value) {
            map.values[key] = value;
            log.deprecate(window, key, value, map === mw.config && 'Use mw.config instead.');
        }

        function logError(topic, data) {
            var msg, e = data.exception;
            if (console && console.log) {
                msg = (e ? 'Exception' : 'Error') + ' in ' + data.source + (data.module ? ' in module ' + data.module : '') + (e ? ':' : '.');
                console.log(msg);
                if (e && console.warn) {
                    console.warn(e);
                }
            }
        }

        function Map(global) {
            this.values = Object.create(null);
            if (global === true) {
                this.set = function(selection, value) {
                    var s;
                    if (arguments.length > 1) {
                        if (typeof selection === 'string') {
                            setGlobalMapValue(this, selection, value);
                            return true;
                        }
                    } else if (typeof selection === 'object') {
                        for (s in selection) {
                            setGlobalMapValue(this, s, selection[s]);
                        }
                        return true;
                    }
                    return false;
                };
            }
        }
        Map.prototype = {
            constructor: Map,
            get: function(selection, fallback) {
                var
                    results, i;
                fallback = arguments.length > 1 ? fallback : null;
                if (Array.isArray(selection)) {
                    results = {};
                    for (i = 0; i < selection.length; i++) {
                        if (typeof selection[i] === 'string') {
                            results[selection[i]] = selection[i] in this.values ? this.values[selection[i]] : fallback;
                        }
                    }
                    return results;
                }
                if (typeof selection === 'string') {
                    return selection in this.values ? this.values[selection] : fallback;
                }
                if (selection === undefined) {
                    results = {};
                    for (i in this.values) {
                        results[i] = this.values[i];
                    }
                    return results;
                }
                return fallback;
            },
            set: function(selection, value) {
                var s;
                if (arguments.length > 1) {
                    if (typeof selection === 'string') {
                        this.values[selection] = value;
                        return true;
                    }
                } else if (typeof selection === 'object') {
                    for (s in selection) {
                        this.values[s] = selection[s];
                    }
                    return true;
                }
                return false;
            },
            exists: function(selection) {
                return typeof selection === 'string' && selection in this.values;
            }
        };
        defineFallbacks();
        log = function() {};
        log.warn = console && console.warn ? Function.prototype.bind.call(console.warn, console) : function() {};
        log.error = console && console.error ? Function.prototype.
        bind.call(console.error, console): function() {};
        log.deprecate = function(obj, key, val, msg, logName) {
            var stacks;

            function maybeLog() {
                var name = logName || key,
                    trace = new Error().stack;
                if (!stacks) {
                    stacks = new StringSet();
                }
                if (!stacks.has(trace)) {
                    stacks.add(trace);
                    if (logName || obj === window) {
                        mw.track('mw.deprecate', name);
                    }
                    mw.log.warn('Use of "' + name + '" is deprecated.' + (msg ? ' ' + msg : ''));
                }
            }
            try {
                Object.defineProperty(obj, key, {
                    configurable: !0,
                    enumerable: !0,
                    get: function() {
                        maybeLog();
                        return val;
                    },
                    set: function(newVal) {
                        maybeLog();
                        val = newVal;
                    }
                });
            } catch (err) {
                obj[key] = val;
            }
        };
        mw = {
            redefineFallbacksForTest: window.QUnit && defineFallbacks,
            now: function() {
                var perf = window.performance,
                    navStart = perf && perf.timing && perf.timing.navigationStart;
                mw.now = navStart && perf.now ? function() {
                    return navStart + perf.now();
                } : Date.now;
                return mw.now();
            },
            trackQueue: [],
            track: function(topic, data) {
                mw.trackQueue.push({
                    topic: topic,
                    data: data
                });
            },
            trackError: function(topic, data) {
                mw.track(topic, data);
                logError(topic, data);
            },
            Map: Map,
            config: new Map(true),
            messages: new Map(),
            templates: new Map(),
            log: log,
            loader: (function() {
                var registry = Object.create(null),
                    sources = Object.create(null),
                    handlingPendingRequests = !1,
                    pendingRequests = [],
                    queue = [],
                    jobs = [],
                    willPropagate = !1,
                    errorModules = [],
                    baseModules = ["jquery", "mediawiki.base"],
                    marker = document.querySelector('meta[name="ResourceLoaderDynamicStyles"]'),
                    lastCssBuffer, rAF = window.requestAnimationFrame || setTimeout;

                function newStyleTag(text, nextNode) {
                    var el = document.createElement('style');
                    el.appendChild(document.createTextNode(text));
                    if (nextNode && nextNode.parentNode) {
                        nextNode.parentNode.insertBefore(el, nextNode);
                    } else {
                        document.head.appendChild(el);
                    }
                    return el;
                }

                function flushCssBuffer(cssBuffer) {
                    var i;
                    if (cssBuffer === lastCssBuffer) {
                        lastCssBuffer = null;
                    }
                    newStyleTag(cssBuffer.cssText, marker);
                    for (i = 0; i < cssBuffer.callbacks.length; i++) {
                        cssBuffer.callbacks[i]();
                    }
                }

                function addEmbeddedCSS(cssText, callback) {
                    if (!lastCssBuffer || cssText.slice(0, '@import'.length) === '@import') {
                        lastCssBuffer = {
                            cssText: '',
                            callbacks: []
                        };
                        rAF
                            (flushCssBuffer.bind(null, lastCssBuffer));
                    }
                    lastCssBuffer.cssText += '\n' + cssText;
                    lastCssBuffer.callbacks.push(callback);
                }

                function getCombinedVersion(modules) {
                    var hashes = modules.reduce(function(result, module) {
                        return result + registry[module].version;
                    }, '');
                    return fnv132(hashes);
                }

                function allReady(modules) {
                    var i = 0;
                    for (; i < modules.length; i++) {
                        if (mw.loader.getState(modules[i]) !== 'ready') {
                            return false;
                        }
                    }
                    return true;
                }

                function allWithImplicitReady(module) {
                    return allReady(registry[module].dependencies) && (baseModules.indexOf(module) !== -1 || allReady(baseModules));
                }

                function anyFailed(modules) {
                    var state, i = 0;
                    for (; i < modules.length; i++) {
                        state = mw.loader.getState(modules[i]);
                        if (state === 'error' || state === 'missing') {
                            return modules[i];
                        }
                    }
                    return false;
                }

                function doPropagation() {
                    var errorModule, baseModuleError, module, i, failed, job, didPropagate = !0;
                    do {
                        didPropagate = !1;
                        while (errorModules.length) {
                            errorModule = errorModules.shift();
                            baseModuleError = baseModules.indexOf(errorModule) !== -1;
                            for (module in registry) {
                                if (registry[
                                        module].state !== 'error' && registry[module].state !== 'missing') {
                                    if (baseModuleError && baseModules.indexOf(module) === -1) {
                                        registry[module].state = 'error';
                                        didPropagate = !0;
                                    } else if (registry[module].dependencies.indexOf(errorModule) !== -1) {
                                        registry[module].state = 'error';
                                        errorModules.push(module);
                                        didPropagate = !0;
                                    }
                                }
                            }
                        }
                        for (module in registry) {
                            if (registry[module].state === 'loaded' && allWithImplicitReady(module)) {
                                execute(module);
                                didPropagate = !0;
                            }
                        }
                        for (i = 0; i < jobs.length; i++) {
                            job = jobs[i];
                            failed = anyFailed(job.dependencies);
                            if (failed !== false || allReady(job.dependencies)) {
                                jobs.splice(i, 1);
                                i -= 1;
                                try {
                                    if (failed !== false && job.error) {
                                        job.error(new Error('Failed dependency: ' + failed), job.dependencies);
                                    } else if (failed === false && job.ready) {
                                        job.ready();
                                    }
                                } catch (e) {
                                    mw.trackError('resourceloader.exception', {
                                        exception: e,
                                        source: 'load-callback'
                                    });
                                }
                                didPropagate = !0;
                            }
                        }
                    } while (didPropagate);
                    willPropagate = !1;
                }

                function requestPropagation() {
                    if (willPropagate) {
                        return;
                    }
                    willPropagate = !0;
                    mw.requestIdleCallback(doPropagation, {
                        timeout: 1
                    });
                }

                function setAndPropagate(module, state) {
                    registry[module].state = state;
                    if (state === 'loaded' || state === 'ready' || state === 'error' || state === 'missing') {
                        if (state === 'ready') {
                            mw.loader.store.add(module);
                        } else if (state === 'error' || state === 'missing') {
                            errorModules.push(module);
                        }
                        requestPropagation();
                    }
                }

                function sortDependencies(module, resolved, unresolved) {
                    var i, skip, deps;
                    if (!(module in registry)) {
                        throw new Error('Unknown module: ' + module);
                    }
                    if (typeof registry[module].skip === 'string') {
                        skip = (new Function(registry[module].skip)());
                        registry[module].skip = !!skip;
                        if (skip) {
                            registry[module].dependencies = [];
                            setAndPropagate(module, 'ready');
                            return;
                        }
                    }
                    if (!unresolved) {
                        unresolved = new StringSet();
                    }
                    deps = registry[module].dependencies;
                    unresolved.add(module);
                    for (i = 0; i < deps.length; i++) {
                        if (resolved.indexOf(deps[i]) === -1) {
                            if (unresolved.has(deps[i])) {
                                throw new Error('Circular reference detected: ' + module + ' -> ' + deps[i]);
                            }
                            sortDependencies(deps[i], resolved, unresolved);
                        }
                    }
                    resolved.push(module);
                }

                function resolve(modules) {
                    var resolved = baseModules.slice(),
                        i = 0;
                    for (; i < modules.length; i++) {
                        sortDependencies(modules[i], resolved);
                    }
                    return resolved;
                }

                function resolveStubbornly(modules) {
                    var saved, resolved = baseModules.slice(),
                        i = 0;
                    for (; i < modules.length; i++) {
                        saved = resolved.slice();
                        try {
                            sortDependencies(modules[i], resolved);
                        } catch (err) {
                            resolved = saved;
                            mw.log.warn('Skipped unresolvable module ' + modules[i]);
                            if (modules[i] in registry) {
                                mw.trackError('resourceloader.exception', {
                                    exception: err,
                                    source: 'resolve'
                                });
                            }
                        }
                    }
                    return resolved;
                }

                function resolveRelativePath(relativePath, basePath) {
                    var prefixes, prefix, baseDirParts, relParts = relativePath.match(/^((?:\.\.?\/)+)(.*)$/);
                    if (!relParts) {
                        return null;
                    }
                    baseDirParts = basePath.split('/');
                    baseDirParts.pop();
                    prefixes = relParts[1].split('/');
                    prefixes.pop();
                    while ((prefix = prefixes.pop()) !== undefined) {
                        if (prefix === '..') {
                            baseDirParts.pop();
                        }
                    }
                    return (baseDirParts.length ? baseDirParts.join('/') + '/' : '') + relParts[2];
                }

                function makeRequireFunction(moduleObj, basePath) {
                    return function require(moduleName) {
                        var
                            fileName, fileContent, result, moduleParam, scriptFiles = moduleObj.script.files;
                        fileName = resolveRelativePath(moduleName, basePath);
                        if (fileName === null) {
                            return mw.loader.require(moduleName);
                        }
                        if (!hasOwn.call(scriptFiles, fileName)) {
                            throw new Error('Cannot require undefined file ' + fileName);
                        }
                        if (hasOwn.call(moduleObj.packageExports, fileName)) {
                            return moduleObj.packageExports[fileName];
                        }
                        fileContent = scriptFiles[fileName];
                        if (typeof fileContent === 'function') {
                            moduleParam = {
                                exports: {}
                            };
                            fileContent(makeRequireFunction(moduleObj, fileName), moduleParam);
                            result = moduleParam.exports;
                        } else {
                            result = fileContent;
                        }
                        moduleObj.packageExports[fileName] = result;
                        return result;
                    };
                }

                function addScript(src, callback) {
                    var script = document.createElement('script');
                    script.src = src;
                    script.onload = script.onerror = function() {
                        if (script.parentNode) {
                            script.parentNode.removeChild(script);
                        }
                        if (callback) {
                            callback();
                            callback = null;
                        }
                    };
                    document.head.appendChild(script);
                }

                function queueModuleScript(src, moduleName, callback) {
                    pendingRequests.push(function() {
                        if (moduleName !== 'jquery') {
                            window.require = mw.loader.require;
                            window.module = registry[moduleName].module;
                        }
                        addScript(src, function() {
                            delete window.module;
                            callback();
                            if (pendingRequests[0]) {
                                pendingRequests.shift()();
                            } else {
                                handlingPendingRequests = !1;
                            }
                        });
                    });
                    if (!handlingPendingRequests && pendingRequests[0]) {
                        handlingPendingRequests = !0;
                        pendingRequests.shift()();
                    }
                }

                function addLink(url, media, nextNode) {
                    var el = document.createElement('link');
                    el.rel = 'stylesheet';
                    if (media) {
                        el.media = media;
                    }
                    el.href = url;
                    if (nextNode && nextNode.parentNode) {
                        nextNode.parentNode.insertBefore(el, nextNode);
                    } else {
                        document.head.appendChild(el);
                    }
                }

                function domEval(code) {
                    var script = document.createElement('script');
                    if (mw.config.get('wgCSPNonce') !== false) {
                        script.nonce = mw.config.get('wgCSPNonce');
                    }
                    script.text = code;
                    document.head.appendChild(script);
                    script.parentNode.removeChild(script);
                }

                function enqueue(dependencies, ready, error) {
                    var failed;
                    if (allReady(dependencies)) {
                        if (ready !== undefined) {
                            ready();
                        }
                        return;
                    }
                    failed = anyFailed(dependencies);
                    if (failed !== false) {
                        if (error !== undefined) {
                            error(new Error('Dependency ' + failed + ' failed to load'), dependencies);
                        }
                        return;
                    }
                    if (ready !== undefined || error !== undefined) {
                        jobs.push({
                            dependencies: dependencies.filter(function(module) {
                                var state = registry[module].state;
                                return state === 'registered' || state === 'loaded' || state === 'loading' || state === 'executing';
                            }),
                            ready: ready,
                            error: error
                        });
                    }
                    dependencies.forEach(function(module) {
                        if (registry[module].state === 'registered' && queue.indexOf(module) === -1) {
                            queue.push(module);
                        }
                    });
                    mw.loader.work();
                }

                function execute(module) {
                    var key, value, media, i, urls, cssHandle, siteDeps, siteDepErr, runScript, cssPending = 0;
                    if (registry[module].state !== 'loaded') {
                        throw new Error('Module in state "' + registry[module].state + '" may not execute: ' + module);
                    }
                    registry[module].state = 'executing';
                    runScript = function() {
                        var script, markModuleReady, nestedAddScript, mainScript;
                        script = registry[module].script;
                        markModuleReady = function() {
                            setAndPropagate(module, 'ready');
                        };
                        nestedAddScript = function(arr, callback, j) {
                            if (j >=
                                arr.length) {
                                callback();
                                return;
                            }
                            queueModuleScript(arr[j], module, function() {
                                nestedAddScript(arr, callback, j + 1);
                            });
                        };
                        try {
                            if (Array.isArray(script)) {
                                nestedAddScript(script, markModuleReady, 0);
                            } else if (typeof script === 'function' || (typeof script === 'object' && script !== null)) {
                                if (typeof script === 'function') {
                                    if (module === 'jquery') {
                                        script();
                                    } else {
                                        script(window.$, window.$, mw.loader.require, registry[module].module);
                                    }
                                } else {
                                    mainScript = script.files[script.main];
                                    if (typeof mainScript !== 'function') {
                                        throw new Error('Main file in module ' + module + ' must be a function');
                                    }
                                    mainScript(makeRequireFunction(registry[module], script.main), registry[module].module);
                                }
                                markModuleReady();
                            } else if (typeof script === 'string') {
                                domEval(script);
                                markModuleReady();
                            } else {
                                markModuleReady();
                            }
                        } catch (e) {
                            setAndPropagate(module, 'error');
                            mw.trackError('resourceloader.exception', {
                                exception: e,
                                module: module,
                                source: 'module-execute'
                            });
                        }
                    };
                    if (registry[module].messages) {
                        mw.messages.set(registry[module].messages);
                    }
                    if (registry[module].templates) {
                        mw.
                        templates.set(module, registry[module].templates);
                    }
                    cssHandle = function() {
                        cssPending++;
                        return function() {
                            var runScriptCopy;
                            cssPending--;
                            if (cssPending === 0) {
                                runScriptCopy = runScript;
                                runScript = undefined;
                                runScriptCopy();
                            }
                        };
                    };
                    if (registry[module].style) {
                        for (key in registry[module].style) {
                            value = registry[module].style[key];
                            media = undefined;
                            if (key !== 'url' && key !== 'css') {
                                if (typeof value === 'string') {
                                    addEmbeddedCSS(value, cssHandle());
                                } else {
                                    media = key;
                                    key = 'bc-url';
                                }
                            }
                            if (Array.isArray(value)) {
                                for (i = 0; i < value.length; i++) {
                                    if (key === 'bc-url') {
                                        addLink(value[i], media, marker);
                                    } else if (key === 'css') {
                                        addEmbeddedCSS(value[i], cssHandle());
                                    }
                                }
                            } else if (typeof value === 'object') {
                                for (media in value) {
                                    urls = value[media];
                                    for (i = 0; i < urls.length; i++) {
                                        addLink(urls[i], media, marker);
                                    }
                                }
                            }
                        }
                    }
                    if (module === 'user') {
                        try {
                            siteDeps = resolve(['site']);
                        } catch (e) {
                            siteDepErr = e;
                            runScript();
                        }
                        if (siteDepErr === undefined) {
                            enqueue(siteDeps, runScript, runScript);
                        }
                    } else if (cssPending === 0) {
                        runScript();
                    }
                }

                function sortQuery(o) {
                    var key, sorted = {},
                        a = [];
                    for (key in o) {
                        a.push(key);
                    }
                    a.sort();
                    for (key = 0; key < a.length; key++) {
                        sorted[a[key]] = o[a[key]];
                    }
                    return sorted;
                }

                function buildModulesString(moduleMap) {
                    var p, prefix, str = [],
                        list = [];

                    function restore(suffix) {
                        return p + suffix;
                    }
                    for (prefix in moduleMap) {
                        p = prefix === '' ? '' : prefix + '.';
                        str.push(p + moduleMap[prefix].join(','));
                        list.push.apply(list, moduleMap[prefix].map(restore));
                    }
                    return {
                        str: str.join('|'),
                        list: list
                    };
                }

                function resolveIndexedDependencies(modules) {
                    var i, j, deps;

                    function resolveIndex(dep) {
                        return typeof dep === 'number' ? modules[dep][0] : dep;
                    }
                    for (i = 0; i < modules.length; i++) {
                        deps = modules[i][2];
                        if (deps) {
                            for (j = 0; j < deps.length; j++) {
                                deps[j] = resolveIndex(deps[j]);
                            }
                        }
                    }
                }

                function makeQueryString(params) {
                    return Object.keys(params).map(function(key) {
                        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                    }).join('&');
                }

                function batchRequest(batch) {
                    var reqBase, splits, b, bSource, bGroup, source, group, i, modules, sourceLoadScript, currReqBase, currReqBaseLength, moduleMap, currReqModules, l, lastDotIndex, prefix, suffix, bytesAdded;

                    function doRequest() {
                        var query = Object.create(currReqBase),
                            packed = buildModulesString(moduleMap);
                        query.modules = packed.str;
                        query.version = getCombinedVersion(packed.list);
                        query = sortQuery(query);
                        addScript(sourceLoadScript + '?' + makeQueryString(query));
                    }
                    if (!batch.length) {
                        return;
                    }
                    batch.sort();
                    reqBase = {
                        "lang": "en",
                        "skin": "vector"
                    };
                    splits = Object.create(null);
                    for (b = 0; b < batch.length; b++) {
                        bSource = registry[batch[b]].source;
                        bGroup = registry[batch[b]].group;
                        if (!splits[bSource]) {
                            splits[bSource] = Object.create(null);
                        }
                        if (!splits[bSource][bGroup]) {
                            splits[bSource][bGroup] = [];
                        }
                        splits[bSource][bGroup].push(batch[b]);
                    }
                    for (source in splits) {
                        sourceLoadScript = sources[source];
                        for (group in splits[source]) {
                            modules = splits[source][group];
                            currReqBase = Object.create(reqBase);
                            if (group === 0 && mw.config.get('wgUserName') !== null) {
                                currReqBase.user = mw.config.get('wgUserName');
                            }
                            currReqBaseLength = makeQueryString(currReqBase).length + 23;
                            l = currReqBaseLength;
                            moduleMap = Object.create(null);
                            currReqModules = [];
                            for (i = 0; i < modules.length; i++) {
                                lastDotIndex = modules[i].lastIndexOf('.');
                                prefix = modules[i].substr(0, lastDotIndex);
                                suffix = modules[i].slice(lastDotIndex + 1);
                                bytesAdded = moduleMap[prefix] ? suffix.length + 3 : modules[i].length + 3;
                                if (currReqModules.length && l + bytesAdded > mw.loader.maxQueryLength) {
                                    doRequest();
                                    l = currReqBaseLength;
                                    moduleMap = Object.create(null);
                                    currReqModules = [];
                                    mw.track('resourceloader.splitRequest', {
                                        maxQueryLength: mw.loader.maxQueryLength
                                    });
                                }
                                if (!moduleMap[prefix]) {
                                    moduleMap[prefix] = [];
                                }
                                l += bytesAdded;
                                moduleMap[prefix].push(suffix);
                                currReqModules.push(modules[i]);
                            }
                            if (currReqModules.length) {
                                doRequest();
                            }
                        }
                    }
                }

                function asyncEval(implementations, cb) {
                    if (!implementations.length) {
                        return;
                    }
                    mw.requestIdleCallback(function() {
                        try {
                            domEval(implementations.join(';'));
                        } catch (err) {
                            cb(err);
                        }
                    });
                }

                function getModuleKey(module) {
                    return module in registry ? (module + '@' + registry[module].version) : null;
                }

                function splitModuleKey(key) {
                    var index = key.indexOf('@');
                    if (index === -1) {
                        return {
                            name: key,
                            version: ''
                        };
                    }
                    return {
                        name: key.slice(0, index),
                        version: key.
                        slice(index + 1)
                    };
                }

                function registerOne(module, version, dependencies, group, source, skip) {
                    if (module in registry) {
                        throw new Error('module already registered: ' + module);
                    }
                    registry[module] = {
                        module: {
                            exports: {}
                        },
                        packageExports: {},
                        version: String(version || ''),
                        dependencies: dependencies || [],
                        group: typeof group === 'undefined' ? null : group,
                        source: typeof source === 'string' ? source : 'local',
                        state: 'registered',
                        skip: typeof skip === 'string' ? skip : null
                    };
                }
                return {
                    moduleRegistry: registry,
                    maxQueryLength: 5000,
                    addStyleTag: newStyleTag,
                    enqueue: enqueue,
                    resolve: resolve,
                    work: function() {
                        var q, module, implementation, storedImplementations = [],
                            storedNames = [],
                            requestNames = [],
                            batch = new StringSet();
                        mw.loader.store.init();
                        q = queue.length;
                        while (q--) {
                            module = queue[q];
                            if (module in registry && registry[module].state === 'registered') {
                                if (!batch.has(module)) {
                                    registry[module].state = 'loading';
                                    batch.add(module);
                                    implementation = mw.loader.store.get(module);
                                    if (implementation) {
                                        storedImplementations.push(implementation);
                                        storedNames.push(module);
                                    } else {
                                        requestNames.push(module);
                                    }
                                }
                            }
                        }
                        queue = [];
                        asyncEval(storedImplementations, function(err) {
                            var failed;
                            mw.loader.store.stats.failed++;
                            mw.loader.store.clear();
                            mw.trackError('resourceloader.exception', {
                                exception: err,
                                source: 'store-eval'
                            });
                            failed = storedNames.filter(function(name) {
                                return registry[name].state === 'loading';
                            });
                            batchRequest(failed);
                        });
                        batchRequest(requestNames);
                    },
                    addSource: function(ids) {
                        var id;
                        for (id in ids) {
                            if (id in sources) {
                                throw new Error('source already registered: ' + id);
                            }
                            sources[id] = ids[id];
                        }
                    },
                    register: function(modules) {
                        var i;
                        if (typeof modules === 'object') {
                            resolveIndexedDependencies(modules);
                            for (i = 0; i < modules.length; i++) {
                                registerOne.apply(null, modules[i]);
                            }
                        } else {
                            registerOne.apply(null, arguments);
                        }
                    },
                    implement: function(module, script, style, messages, templates) {
                        var split = splitModuleKey(module),
                            name = split.name,
                            version = split.version;
                        if (!(name in registry)) {
                            mw.loader.register(name);
                        }
                        if (registry[name].script !== undefined) {
                            throw new Error('module already implemented: ' + name);
                        }
                        if (version) {
                            registry[name].version = version;
                        }
                        registry[name].script = script || null;
                        registry[name].style = style || null;
                        registry[name].messages = messages || null;
                        registry[name].templates = templates || null;
                        if (registry[name].state !== 'error' && registry[name].state !== 'missing') {
                            setAndPropagate(name, 'loaded');
                        }
                    },
                    load: function(modules, type) {
                        if (typeof modules === 'string' && /^(https?:)?\/?\//.test(modules)) {
                            if (type === 'text/css') {
                                addLink(modules);
                            } else if (type === 'text/javascript' || type === undefined) {
                                addScript(modules);
                            } else {
                                throw new Error('Invalid type ' + type);
                            }
                        } else {
                            modules = typeof modules === 'string' ? [modules] : modules;
                            enqueue(resolveStubbornly(modules), undefined, undefined);
                        }
                    },
                    state: function(states) {
                        var module, state;
                        for (module in states) {
                            state = states[module];
                            if (!(module in registry)) {
                                mw.loader.register(module);
                            }
                            setAndPropagate(module, state);
                        }
                    },
                    getState: function(module) {
                        return module in registry ? registry[module].state : null;
                    },
                    getModuleNames: function() {
                        return Object.keys(registry);
                    },
                    require: function(moduleName) {
                        var state = mw.
                        loader.getState(moduleName);
                        if (state !== 'ready') {
                            throw new Error('Module "' + moduleName + '" is not loaded');
                        }
                        return registry[moduleName].module.exports;
                    },
                    store: {
                        enabled: null,
                        MODULE_SIZE_MAX: 1e5,
                        items: {},
                        queue: [],
                        stats: {
                            hits: 0,
                            misses: 0,
                            expired: 0,
                            failed: 0
                        },
                        toJSON: function() {
                            return {
                                items: mw.loader.store.items,
                                vary: mw.loader.store.vary,
                                asOf: Math.ceil(Date.now() / 1e7)
                            };
                        },
                        key: "MediaWikiModuleStore:enwiki",
                        vary: "vector:1-3:en",
                        init: function() {
                            var raw, data;
                            if (this.enabled !== null) {
                                return;
                            }
                            if (!true || /Firefox/.test(navigator.userAgent)) {
                                this.clear();
                                this.enabled = !1;
                                return;
                            }
                            try {
                                raw = localStorage.getItem(this.key);
                                this.enabled = !0;
                                data = JSON.parse(raw);
                                if (data && typeof data.items === 'object' && data.vary === this.vary && Date.now() < (data.asOf * 1e7) + 259e7) {
                                    this.items = data.items;
                                    return;
                                }
                            } catch (e) {}
                            if (raw === undefined) {
                                this.enabled = !1;
                            }
                        },
                        get: function(module) {
                            var key;
                            if (this.enabled) {
                                key = getModuleKey(module);
                                if (key in this.items) {
                                    this.stats.hits++;
                                    return this.items[key];
                                }
                                this.stats.misses++;
                            }
                            return false;
                        },
                        add: function(module) {
                            if (this.enabled) {
                                this.queue.push(module);
                                this.requestUpdate();
                            }
                        },
                        set: function(module) {
                            var key, args, src, encodedScript, descriptor = mw.loader.moduleRegistry[module];
                            key = getModuleKey(module);
                            if (key in this.items || !descriptor || descriptor.state !== 'ready' || !descriptor.version || descriptor.group === 1 || descriptor.group === 0 || [descriptor.script, descriptor.style, descriptor.messages, descriptor.templates].indexOf(undefined) !== -1) {
                                return;
                            }
                            try {
                                if (typeof descriptor.script === 'function') {
                                    encodedScript = String(descriptor.script);
                                } else if (typeof descriptor.script === 'object' && descriptor.script && !Array.isArray(descriptor.script)) {
                                    encodedScript = '{' + 'main:' + JSON.stringify(descriptor.script.main) + ',' + 'files:{' + Object.keys(descriptor.script.files).map(function(file) {
                                        var value = descriptor.script.files[file];
                                        return JSON.stringify(file) + ':' + (typeof value === 'function' ? value : JSON.stringify(value));
                                    }).join(',') + '}}';
                                } else {
                                    encodedScript = JSON.stringify(descriptor.script);
                                }
                                args = [JSON.stringify(key),
                                    encodedScript, JSON.stringify(descriptor.style), JSON.stringify(descriptor.messages), JSON.stringify(descriptor.templates)
                                ];
                            } catch (e) {
                                mw.trackError('resourceloader.exception', {
                                    exception: e,
                                    source: 'store-localstorage-json'
                                });
                                return;
                            }
                            src = 'mw.loader.implement(' + args.join(',') + ');';
                            if (src.length > this.MODULE_SIZE_MAX) {
                                return;
                            }
                            this.items[key] = src;
                        },
                        prune: function() {
                            var key, module;
                            for (key in this.items) {
                                module = key.slice(0, key.indexOf('@'));
                                if (getModuleKey(module) !== key) {
                                    this.stats.expired++;
                                    delete this.items[key];
                                } else if (this.items[key].length > this.MODULE_SIZE_MAX) {
                                    delete this.items[key];
                                }
                            }
                        },
                        clear: function() {
                            this.items = {};
                            try {
                                localStorage.removeItem(this.key);
                            } catch (e) {}
                        },
                        requestUpdate: (function() {
                            var hasPendingWrites = !1;

                            function flushWrites() {
                                var data, key;
                                mw.loader.store.prune();
                                while (mw.loader.store.queue.length) {
                                    mw.loader.store.set(mw.loader.store.queue.shift());
                                }
                                key = mw.loader.store.key;
                                try {
                                    localStorage.removeItem(key);
                                    data = JSON.stringify(mw.loader.store);
                                    localStorage.setItem(key, data);
                                } catch (e) {
                                    mw.trackError('resourceloader.exception', {
                                        exception: e,
                                        source: 'store-localstorage-update'
                                    });
                                }
                                hasPendingWrites = !1;
                            }

                            function onTimeout() {
                                mw.requestIdleCallback(flushWrites);
                            }
                            return function() {
                                if (!hasPendingWrites) {
                                    hasPendingWrites = !0;
                                    setTimeout(onTimeout, 2000);
                                }
                            };
                        }())
                    }
                };
            }())
        };
        window.mw = window.mediaWiki = mw;
    }());
    mw.requestIdleCallbackInternal = function(callback) {
        setTimeout(function() {
            var start = mw.now();
            callback({
                didTimeout: !1,
                timeRemaining: function() {
                    return Math.max(0, 50 - (mw.now() - start));
                }
            });
        }, 1);
    };
    mw.requestIdleCallback = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : mw.requestIdleCallbackInternal;
    (function() {
        var queue;
        mw.loader.addSource({
            "local": "https://en.wikipedia.org/w/load.php",
            "metawiki": "https://meta.wikimedia.org/w/load.php"
        });
        mw.loader.register([
            ["site", "rcap7", [1]],
            ["site.styles", "1yw6p", [], 2],
            ["noscript", "r22l1", [], 3],
            ["filepage", "spr0c"],
            ["user", "k1cuu", [], 0],
            ["user.styles", "8fimp", [], 0],
            ["user.defaults", "3maoj"],
            ["user.options", "1hzgi", [6], 1],
            [
                "mediawiki.skinning.elements", "ye63q"
            ],
            ["mediawiki.skinning.content", "1dav0"],
            ["mediawiki.skinning.interface", "1vjkt"],
            ["jquery.makeCollapsible.styles", "3x9mx"],
            ["mediawiki.skinning.content.parsoid", "94yvz"],
            ["mediawiki.skinning.content.externallinks", "8vsgt"],
            ["jquery", "yntai"],
            ["es6-promise", "1eg94", [], null, null, "return typeof Promise==='function'\u0026\u0026Promise.prototype.finally;"],
            ["mediawiki.base", "1ktzh", [14]],
            ["jquery.chosen", "oqs2c"],
            ["jquery.client", "fn93f"],
            ["jquery.color", "dcjsx"],
            ["jquery.confirmable", "11aay", [110]],
            ["jquery.cookie", "1ikjr"],
            ["jquery.form", "1wtf2"],
            ["jquery.fullscreen", "1xq4o"],
            ["jquery.highlightText", "1tsxs", [84]],
            ["jquery.hoverIntent", "1aklr"],
            ["jquery.i18n", "29w1w", [109]],
            ["jquery.lengthLimit", "1llrz", [67]],
            ["jquery.makeCollapsible", "4pi6s", [11]],
            ["jquery.mw-jump", "r425l"],
            ["jquery.spinner", "16kkr", [31]],
            ["jquery.spinner.styles", "o62ui"],
            ["jquery.jStorage", "1ccp7"],
            ["jquery.suggestions", "9e98z", [24]],
            ["jquery.tablesorter", "1v038", [35, 111, 84]],
            [
                "jquery.tablesorter.styles", "aer1p"
            ],
            ["jquery.textSelection", "152er", [18]],
            ["jquery.throttle-debounce", "xl0tk"],
            ["jquery.tipsy", "x724n"],
            ["jquery.ui", "1dv91"],
            ["moment", "d6rz2", [107, 84]],
            ["vue", "5urmd"],
            ["vuex", "c4upc", [15, 41]],
            ["mediawiki.template", "xae8l"],
            ["mediawiki.template.mustache", "nyt38", [43]],
            ["mediawiki.apipretty", "1cr6m"],
            ["mediawiki.api", "cvcvh", [72, 110]],
            ["mediawiki.content.json", "2o56x"],
            ["mediawiki.confirmCloseWindow", "1khkw"],
            ["mediawiki.debug", "refdk", [199]],
            ["mediawiki.diff.styles", "11ryc"],
            ["mediawiki.feedback", "qgk9z", [968, 207]],
            ["mediawiki.feedlink", "szobh"],
            ["mediawiki.filewarning", "18i22", [199, 211]],
            ["mediawiki.ForeignApi", "191mv", [345]],
            ["mediawiki.ForeignApi.core", "1iho5", [81, 46, 195]],
            ["mediawiki.helplink", "12yue"],
            ["mediawiki.hlist", "1egi4"],
            ["mediawiki.htmlform", "1gh9l", [27, 84]],
            ["mediawiki.htmlform.ooui", "14rir", [199]],
            ["mediawiki.htmlform.styles", "8cw3d"],
            ["mediawiki.htmlform.ooui.styles", "1v6kh"],
            ["mediawiki.icon", "j5ayk"],
            ["mediawiki.inspect", "f3swb", [67, 84]],
            ["mediawiki.notification", "1rsgn", [84, 91]],
            ["mediawiki.notification.convertmessagebox", "3la3s", [64]],
            ["mediawiki.notification.convertmessagebox.styles", "wj24b"],
            ["mediawiki.String", "15280"],
            ["mediawiki.pager.tablePager", "u9adc"],
            ["mediawiki.pulsatingdot", "tj1mg"],
            ["mediawiki.searchSuggest", "scjap", [33, 46]],
            ["mediawiki.storage", "187em"],
            ["mediawiki.Title", "1rych", [67, 84]],
            ["mediawiki.Upload", "1sdt0", [46]],
            ["mediawiki.ForeignUpload", "r1cfg", [54, 73]],
            ["mediawiki.ForeignStructuredUpload", "mi56z", [74]],
            ["mediawiki.Upload.Dialog", "issxg", [77]],
            ["mediawiki.Upload.BookletLayout", "16te3", [73, 82, 192, 40, 202, 207, 212, 213]],
            ["mediawiki.ForeignStructuredUpload.BookletLayout", "cpmmk", [75, 77, 114, 178, 172]],
            ["mediawiki.toc", "ckf9m", [88]],
            ["mediawiki.toc.styles", "11vtw"],
            ["mediawiki.Uri", "sqmr8", [84]],
            ["mediawiki.user", "93pz6", [46, 88]],
            ["mediawiki.userSuggest", "18k7y", [33, 46]],
            ["mediawiki.util", "1dty3", [18]],
            ["mediawiki.viewport", "1vq57"],
            ["mediawiki.checkboxtoggle", "2yuhf"],
            [
                "mediawiki.checkboxtoggle.styles", "15kl9"
            ],
            ["mediawiki.cookie", "4wtg3", [21]],
            ["mediawiki.experiments", "hufn5"],
            ["mediawiki.editfont.styles", "vdv4o"],
            ["mediawiki.visibleTimeout", "8jus4"],
            ["mediawiki.action.delete", "1dgz0", [27, 199]],
            ["mediawiki.action.edit", "7m3u9", [36, 94, 46, 90, 174]],
            ["mediawiki.action.edit.styles", "1y8mk"],
            ["mediawiki.action.edit.collapsibleFooter", "mu8ur", [28, 62, 71]],
            ["mediawiki.action.edit.preview", "13n6d", [30, 36, 50, 82, 199]],
            ["mediawiki.action.history", "vgbiv", [28]],
            ["mediawiki.action.history.styles", "1mrr9"],
            ["mediawiki.action.view.metadata", "1h3zt", [106]],
            ["mediawiki.action.view.categoryPage.styles", "k3t6m"],
            ["mediawiki.action.view.postEdit", "1i11b", [110, 64]],
            ["mediawiki.action.view.redirect", "19xk3", [18]],
            ["mediawiki.action.view.redirectPage", "1ghvh"],
            ["mediawiki.action.edit.editWarning", "1gdkg", [36, 48, 110]],
            ["mediawiki.action.edit.watchlistExpiry", "1xejr", [199]],
            ["mediawiki.action.view.filepage", "1xmp4"],
            ["mediawiki.language", "xbgr9", [108]],
            ["mediawiki.cldr",
                "erqtv", [109]
            ],
            ["mediawiki.libs.pluralruleparser", "pvwvv"],
            ["mediawiki.jqueryMsg", "1i1zt", [107, 84, 7]],
            ["mediawiki.language.months", "1mcng", [107]],
            ["mediawiki.language.names", "yhivw", [107]],
            ["mediawiki.language.specialCharacters", "omeh4", [107]],
            ["mediawiki.libs.jpegmeta", "c4xwo"],
            ["mediawiki.page.gallery", "1lzpw", [37, 116]],
            ["mediawiki.page.gallery.styles", "jhck1"],
            ["mediawiki.page.gallery.slideshow", "164d3", [46, 202, 221, 223]],
            ["mediawiki.page.ready", "7wmca", [46]],
            ["mediawiki.page.watch.ajax", "s384x", [46]],
            ["mediawiki.page.image.pagination", "1hhs1", [30, 84]],
            ["mediawiki.rcfilters.filters.base.styles", "xgfab"],
            ["mediawiki.rcfilters.highlightCircles.seenunseen.styles", "uvpnx"],
            ["mediawiki.rcfilters.filters.dm", "169v1", [81, 82, 195]],
            ["mediawiki.rcfilters.filters.ui", "a4ahr", [28, 123, 169, 208, 215, 217, 218, 219, 221, 222]],
            ["mediawiki.interface.helpers.styles", "1nsvz"],
            ["mediawiki.special", "qlucy"],
            ["mediawiki.special.apisandbox", "10wx6", [28, 81, 188, 175, 198, 213, 218]],
            ["mediawiki.special.block", "bbzkl",
                [58, 172, 187, 179, 188, 185, 213, 215]
            ],
            ["mediawiki.misc-authed-ooui", "157ll", [59, 169, 174]],
            ["mediawiki.misc-authed-pref", "r18bc", [7]],
            ["mediawiki.misc-authed-curate", "18ydi", [20, 30, 46]],
            ["mediawiki.special.changeslist", "zjt4l"],
            ["mediawiki.special.changeslist.watchlistexpiry", "1jn93", [126]],
            ["mediawiki.special.changeslist.enhanced", "19caq"],
            ["mediawiki.special.changeslist.legend", "1w3ma"],
            ["mediawiki.special.changeslist.legend.js", "ntrpi", [28, 88]],
            ["mediawiki.special.contributions", "wcllz", [28, 110, 172, 198]],
            ["mediawiki.special.edittags", "1x1ih", [17, 27]],
            ["mediawiki.special.import", "o75mv"],
            ["mediawiki.special.preferences.ooui", "1pcv5", [48, 90, 65, 71, 179, 174]],
            ["mediawiki.special.preferences.styles.ooui", "1u4dp"],
            ["mediawiki.special.recentchanges", "13ytr", [169]],
            ["mediawiki.special.revisionDelete", "1a7mj", [27]],
            ["mediawiki.special.search", "1cmha", [190]],
            ["mediawiki.special.search.commonsInterwikiWidget", "1s9x8", [81, 46]],
            ["mediawiki.special.search.interwikiwidget.styles", "sbqd1"],
            [
                "mediawiki.special.search.styles", "v73l4"
            ],
            ["mediawiki.special.undelete", "1c8yo", [169, 174]],
            ["mediawiki.special.unwatchedPages", "urar8", [46]],
            ["mediawiki.special.upload", "17a9y", [30, 46, 48, 114, 126, 43]],
            ["mediawiki.special.userlogin.common.styles", "12rgj"],
            ["mediawiki.special.userlogin.login.styles", "lttkh"],
            ["mediawiki.special.createaccount", "132c3", [46]],
            ["mediawiki.special.userlogin.signup.styles", "ejej5"],
            ["mediawiki.special.userrights", "15936", [27, 65]],
            ["mediawiki.special.watchlist", "1brbr", [46, 199, 218]],
            ["mediawiki.special.version", "1qu9b"],
            ["mediawiki.legacy.config", "1c6k1"],
            ["mediawiki.legacy.commonPrint", "1j0nr"],
            ["mediawiki.legacy.protect", "pa56c", [27]],
            ["mediawiki.legacy.shared", "1tjl0"],
            ["mediawiki.ui", "1y81l"],
            ["mediawiki.ui.checkbox", "1p5nc"],
            ["mediawiki.ui.radio", "q6nl8"],
            ["mediawiki.ui.anchor", "1g2l8"],
            ["mediawiki.ui.button", "ngt5n"],
            ["mediawiki.ui.input", "ch9ii"],
            ["mediawiki.ui.icon", "pcm29"],
            ["mediawiki.widgets", "3g2qv", [46, 170, 202, 212]],
            ["mediawiki.widgets.styles",
                "rqacs"
            ],
            ["mediawiki.widgets.AbandonEditDialog", "1n79q", [207]],
            ["mediawiki.widgets.DateInputWidget", "1gjq6", [173, 40, 202, 223]],
            ["mediawiki.widgets.DateInputWidget.styles", "puudf"],
            ["mediawiki.widgets.visibleLengthLimit", "1wyjs", [27, 199]],
            ["mediawiki.widgets.datetime", "nfok6", [84, 199, 222, 223]],
            ["mediawiki.widgets.expiry", "19dtp", [175, 40, 202]],
            ["mediawiki.widgets.CheckMatrixWidget", "12na7", [199]],
            ["mediawiki.widgets.CategoryMultiselectWidget", "tfu5z", [54, 202]],
            ["mediawiki.widgets.SelectWithInputWidget", "oe83m", [180, 202]],
            ["mediawiki.widgets.SelectWithInputWidget.styles", "1fufa"],
            ["mediawiki.widgets.SizeFilterWidget", "sawvf", [182, 202]],
            ["mediawiki.widgets.SizeFilterWidget.styles", "15b9u"],
            ["mediawiki.widgets.MediaSearch", "2yjig", [54, 202]],
            ["mediawiki.widgets.Table", "1gmb8", [202]],
            ["mediawiki.widgets.UserInputWidget", "1oqp3", [46, 202]],
            ["mediawiki.widgets.UsersMultiselectWidget", "1iec8", [46, 202]],
            ["mediawiki.widgets.NamespacesMultiselectWidget", "1nuht", [202]],
            [
                "mediawiki.widgets.TitlesMultiselectWidget", "2tq85", [169]
            ],
            ["mediawiki.widgets.TagMultiselectWidget.styles", "1vzh9"],
            ["mediawiki.widgets.SearchInputWidget", "1ri9j", [70, 169, 218]],
            ["mediawiki.widgets.SearchInputWidget.styles", "68its"],
            ["mediawiki.widgets.StashedFileWidget", "nie9t", [46, 199]],
            ["mediawiki.watchstar.widgets", "1ya1g", [198]],
            ["mediawiki.deflate", "gu4pi"],
            ["oojs", "1fhbo"],
            ["mediawiki.router", "1f8qs", [197]],
            ["oojs-router", "1xhla", [195]],
            ["oojs-ui", "yfxca", [205, 202, 207]],
            ["oojs-ui-core", "1doun", [107, 195, 201, 200, 209]],
            ["oojs-ui-core.styles", "qzxk2"],
            ["oojs-ui-core.icons", "b465c"],
            ["oojs-ui-widgets", "13chy", [199, 204]],
            ["oojs-ui-widgets.styles", "1lbaq"],
            ["oojs-ui-widgets.icons", "14l5f"],
            ["oojs-ui-toolbars", "1851g", [199, 206]],
            ["oojs-ui-toolbars.icons", "38ilj"],
            ["oojs-ui-windows", "188it", [199, 208]],
            ["oojs-ui-windows.icons", "1efbd"],
            ["oojs-ui.styles.indicators", "1srlr"],
            ["oojs-ui.styles.icons-accessibility", "cntcq"],
            ["oojs-ui.styles.icons-alerts", "kp9fb"],
            [
                "oojs-ui.styles.icons-content", "qqjbc"
            ],
            ["oojs-ui.styles.icons-editing-advanced", "1a2gm"],
            ["oojs-ui.styles.icons-editing-citation", "1e6wt"],
            ["oojs-ui.styles.icons-editing-core", "uxp0s"],
            ["oojs-ui.styles.icons-editing-list", "h9cuf"],
            ["oojs-ui.styles.icons-editing-styling", "1jbp4"],
            ["oojs-ui.styles.icons-interactions", "1nnh9"],
            ["oojs-ui.styles.icons-layout", "1ch1z"],
            ["oojs-ui.styles.icons-location", "16lzi"],
            ["oojs-ui.styles.icons-media", "1kmyn"],
            ["oojs-ui.styles.icons-moderation", "u6hq6"],
            ["oojs-ui.styles.icons-movement", "iurpg"],
            ["oojs-ui.styles.icons-user", "1e0l2"],
            ["oojs-ui.styles.icons-wikimedia", "1g6hj"],
            ["skins.vector.styles.legacy", "leaul"],
            ["skins.vector.styles", "nkoq1"],
            ["skins.vector.styles.responsive", "eamjn"],
            ["skins.vector.js", "18r70", [118]],
            ["skins.vector.legacy.js", "1fsi3", [118]],
            ["skins.monobook.styles", "1n6c8"],
            ["skins.monobook.responsive", "7x3ka"],
            ["skins.monobook.mobile.uls", "18u9r"],
            ["skins.monobook.mobile.echohack", "12ty6", [84, 211]],
            ["skins.monobook.mobile", "n7zf1", [
                84
            ]],
            ["skins.modern", "1uwm6"],
            ["skins.cologneblue.i18n", "5yd6a"],
            ["skins.cologneblue", "1aqql"],
            ["skins.timeless", "oz7yn"],
            ["skins.timeless.js", "1ny8e"],
            ["ext.timeline.styles", "xg0ao"],
            ["ext.wikihiero", "1llrs"],
            ["ext.wikihiero.special", "uy106", [242, 30, 199]],
            ["ext.wikihiero.visualEditor", "137xp", [461]],
            ["ext.charinsert", "19mp5", [36]],
            ["ext.charinsert.styles", "1mhyc"],
            ["ext.cite.styles", "u9796"],
            ["ext.cite.style", "uqkn4"],
            ["ext.cite.visualEditor.core", "19l51", [469]],
            ["ext.cite.visualEditor.data", "1watq", [451]],
            ["ext.cite.visualEditor", "16eer", [248, 247, 249, 250, 211, 214, 218]],
            ["ext.cite.ux-enhancements", "rb95f"],
            ["ext.citeThisPage", "1ygkn"],
            ["ext.inputBox.styles", "1abiw"],
            ["ext.inputBox", "ae2hh", [37]],
            ["ext.pygments", "ziser"],
            ["ext.flaggedRevs.basic", "lusbv"],
            ["ext.flaggedRevs.advanced", "tivqc", [84]],
            ["ext.flaggedRevs.review", "118io", [82]],
            ["ext.flaggedRevs.review.styles", "1wxcy"],
            ["ext.flaggedRevs.icons", "1dsph"],
            ["ext.categoryTree", "142sc", [46]],
            ["ext.categoryTree.styles", "1jrrm"],
            [
                "ext.spamBlacklist.visualEditor", "v2zpq"
            ],
            ["mediawiki.api.titleblacklist", "wyv4b", [46]],
            ["ext.titleblacklist.visualEditor", "emzm0"],
            ["mw.PopUpMediaTransform", "1k9md", [284, 72, 287, 268]],
            ["mw.PopUpMediaTransform.styles", "1ceg6"],
            ["mw.TMHGalleryHook.js", "1g8ta"],
            ["ext.tmh.embedPlayerIframe", "31nih", [302, 287]],
            ["mw.MediaWikiPlayerSupport", "isf2t", [301, 287]],
            ["mw.MediaWikiPlayer.loader", "1kyjg", [303, 318]],
            ["ext.tmh.video-js", "dpzp3"],
            ["ext.tmh.videojs-ogvjs", "kgi48", [285, 273]],
            ["ext.tmh.videojs-resolution-switcher", "1cf85", [273]],
            ["ext.tmh.mw-info-button", "1vsjj", [273, 72]],
            ["ext.tmh.player", "1y7ke", [284, 72]],
            ["ext.tmh.player.dialog", "1baso", [279, 281, 207]],
            ["ext.tmh.player.inline", "w7xx2", [276, 275]],
            ["ext.tmh.player.styles", "bbak5"],
            ["ext.tmh.player.inline.styles", "zuann"],
            ["ext.tmh.thumbnail.styles", "2j0x5"],
            ["ext.tmh.transcodetable", "l3wgg", [46, 198]],
            ["ext.tmh.OgvJsSupport", "5vtte"],
            ["ext.tmh.OgvJs", "10mqv", [284]],
            ["embedPlayerIframeStyle", "lkkli"],
            ["mw.MwEmbedSupport", "1grjc", [288, 290, 299,
                298, 291
            ]],
            ["Spinner", "1913m", [84]],
            ["iScroll", "1tnmd"],
            ["jquery.loadingSpinner", "scnci"],
            ["mw.MwEmbedSupport.style", "1n6fe"],
            ["mediawiki.UtilitiesTime", "o55id"],
            ["mediawiki.client", "1ahv3"],
            ["mediawiki.absoluteUrl", "17zfv", [81]],
            ["mw.ajaxProxy", "ulh0j"],
            ["fullScreenApi", "4y6d4"],
            ["jquery.embedMenu", "123nf"],
            ["jquery.triggerQueueCallback", "dt3pe"],
            ["jquery.mwEmbedUtil", "16pz2"],
            ["jquery.debouncedresize", "rz9ui"],
            ["mw.Api", "1ari9"],
            ["jquery.embedPlayer", "xxx6c"],
            ["mw.EmbedPlayer.loader", "1vehf", [302]],
            ["mw.MediaElement", "d4qk2", [284]],
            ["mw.MediaPlayer", "qwb7t"],
            ["mw.MediaPlayers", "1uolz", [305]],
            ["mw.MediaSource", "ubhxj", [287]],
            ["mw.EmbedTypes", "uzzuj", [81, 306]],
            ["mw.EmbedPlayer", "19l0p", [296, 21, 300, 297, 25, 39, 292, 294, 293, 110, 312, 308, 304, 307]],
            ["mw.EmbedPlayerKplayer", "f4wup"],
            ["mw.EmbedPlayerGeneric", "rdm0a"],
            ["mw.EmbedPlayerNative", "1ic4s"],
            ["mw.EmbedPlayerVLCApp", "c3ijc", [81]],
            ["mw.EmbedPlayerIEWebMPrompt", "yt5k5"],
            ["mw.EmbedPlayerOgvJs", "j7uo6", [284, 30]],
            ["mw.EmbedPlayerImageOverlay",
                "tslgl"
            ],
            ["mw.EmbedPlayerVlc", "1oc1c"],
            ["mw.TimedText.loader", "19pg5"],
            ["mw.TimedText", "10tsc", [112, 309, 320]],
            ["mw.TextSource", "3lvxc", [292, 295]],
            ["ext.urlShortener.special", "10n4n", [81, 59, 169, 198]],
            ["ext.urlShortener.toolbar", "sz22o", [46]],
            ["ext.securepoll.htmlform", "msdw1"],
            ["ext.securepoll", "yaakw"],
            ["ext.securepoll.special", "tfrzl"],
            ["ext.score.visualEditor", "11t6a", [327, 461]],
            ["ext.score.visualEditor.icons", "614uv"],
            ["ext.score.popup", "wf9bo", [46]],
            ["ext.score.errors", "1ag06"],
            ["ext.cirrus.serp", "njjnh", [81]],
            ["ext.cirrus.explore-similar", "1wuyx", [46, 44]],
            ["ext.nuke.confirm", "qvw09", [110]],
            ["ext.confirmEdit.editPreview.ipwhitelist.styles", "snao4"],
            ["ext.confirmEdit.visualEditor", "1o5d1", [951]],
            ["ext.confirmEdit.simpleCaptcha", "13yvy"],
            ["ext.confirmEdit.fancyCaptcha.styles", "57k1s"],
            ["ext.confirmEdit.fancyCaptcha", "1yib6", [46]],
            ["ext.confirmEdit.fancyCaptchaMobile", "1yib6", [523]],
            ["ext.centralauth", "zvjxm", [30, 84]],
            ["ext.centralauth.centralautologin", "is4i1", [110]],
            [
                "ext.centralauth.centralautologin.clearcookie", "1cv2l"
            ],
            ["ext.centralauth.misc.styles", "ckz4t"],
            ["ext.centralauth.globaluserautocomplete", "i1ejb", [33, 46]],
            ["ext.centralauth.globalrenameuser", "xg635", [84]],
            ["ext.centralauth.ForeignApi", "18nb7", [55]],
            ["ext.widgets.GlobalUserInputWidget", "manwk", [46, 202]],
            ["ext.GlobalUserPage", "1jr7i"],
            ["ext.apifeatureusage", "1uio2"],
            ["ext.dismissableSiteNotice", "ylim6", [21, 84]],
            ["ext.dismissableSiteNotice.styles", "grnip"],
            ["ext.centralNotice.startUp", "1dmh2", [353]],
            ["ext.centralNotice.geoIP", "pyo3i", [21]],
            ["ext.centralNotice.choiceData", "p4kul", [356, 357, 358, 359]],
            ["ext.centralNotice.display", "1esz0", [352, 355, 642, 81, 71]],
            ["ext.centralNotice.kvStore", "1phlw"],
            ["ext.centralNotice.bannerHistoryLogger", "1ua2y", [354]],
            ["ext.centralNotice.impressionDiet", "sars6", [354]],
            ["ext.centralNotice.largeBannerLimit", "1ni9e", [354]],
            ["ext.centralNotice.legacySupport", "1u2eu", [354]],
            ["ext.centralNotice.bannerSequence", "1ffw8", [354]],
            ["ext.centralNotice.freegeoipLookup",
                "v1vef", [352]
            ],
            ["ext.centralNotice.impressionEventsSampleRate", "1ig8o", [354]],
            ["ext.centralNotice.cspViolationAlert", "szici"],
            ["ext.wikimediamessages.contactpage.affcomusergroup", "gj1hn"],
            ["mediawiki.special.block.feedback.request", "1eini"],
            ["ext.collection", "3xtlh", [368, 39, 107]],
            ["ext.collection.bookcreator.styles", "rv537"],
            ["ext.collection.bookcreator", "1crce", [367, 32, 84]],
            ["ext.collection.checkLoadFromLocalStorage", "1qpuo", [366]],
            ["ext.collection.suggest", "16bak", [368]],
            ["ext.collection.offline", "1rlao"],
            ["ext.collection.bookcreator.messageBox", "yfxca", [374, 373, 57]],
            ["ext.collection.bookcreator.messageBox.styles", "13xpx"],
            ["ext.collection.bookcreator.messageBox.icons", "2eiyg"],
            ["ext.ElectronPdfService.print.styles", "1868z"],
            ["ext.ElectronPdfService.special.styles", "1jjgx"],
            ["ext.ElectronPdfService.special.selectionImages", "14pwn"],
            ["ext.advancedSearch.initialstyles", "y7h96"],
            ["ext.advancedSearch.styles", "1hxp4"],
            ["ext.advancedSearch.searchtoken", "1v7b7", [], 1],
            [
                "ext.advancedSearch.elements", "1gyke", [379, 81, 82, 202, 218, 219]
            ],
            ["ext.advancedSearch.init", "9yq1c", [381, 380]],
            ["ext.advancedSearch.SearchFieldUI", "olx6i", [72, 202]],
            ["ext.abuseFilter", "1iiv2"],
            ["ext.abuseFilter.edit", "aqpc0", [30, 36, 46, 48, 202]],
            ["ext.abuseFilter.tools", "1lprn", [30, 46]],
            ["ext.abuseFilter.examine", "11l4r", [30, 46]],
            ["ext.abuseFilter.ace", "1jikg", [611]],
            ["ext.abuseFilter.visualEditor", "1b19z"],
            ["ext.wikiEditor", "bbgp0", [33, 36, 37, 39, 113, 82, 202, 212, 213, 214, 215, 216, 217, 221, 43], 4],
            ["ext.wikiEditor.styles", "6r04s", [], 4],
            ["ext.CodeMirror", "18dvj", [393, 36, 39, 82, 217]],
            ["ext.CodeMirror.data", "11s5j"],
            ["ext.CodeMirror.lib", "14yw8"],
            ["ext.CodeMirror.mode.mediawiki", "mcdkt", [394]],
            ["ext.CodeMirror.lib.mode.css", "1934i", [394]],
            ["ext.CodeMirror.lib.mode.javascript", "8lc8p", [394]],
            ["ext.CodeMirror.lib.mode.xml", "1aj3q", [394]],
            ["ext.CodeMirror.lib.mode.htmlmixed", "1j6tv", [396, 397, 398]],
            ["ext.CodeMirror.lib.mode.clike", "furp6", [394]],
            ["ext.CodeMirror.lib.mode.php", "1iw8b", [400, 399]],
            [
                "ext.CodeMirror.visualEditor.init", "16t7e"
            ],
            ["ext.CodeMirror.visualEditor", "lk35n", [461]],
            ["ext.acw.eventlogging", "18ylz"],
            ["ext.acw.landingPageStyles", "2d8i3"],
            ["ext.MassMessage.styles", "1kc29"],
            ["ext.MassMessage.special.js", "bs70l", [27, 37, 39, 110]],
            ["ext.MassMessage.content.js", "1loyf", [20, 39, 46]],
            ["ext.MassMessage.create", "rnvl9", [39, 59, 110]],
            ["ext.MassMessage.edit", "1ekku", [174, 198]],
            ["ext.betaFeatures", "rqm7i", [18, 199]],
            ["ext.betaFeatures.styles", "dw6w7"],
            ["mmv", "u4bim", [19, 23, 37, 38, 81, 418]],
            ["mmv.ui.ondemandshareddependencies", "cz4jt", [413, 198]],
            ["mmv.ui.download.pane", "16hyg", [162, 169, 414]],
            ["mmv.ui.reuse.shareembed", "1okiq", [169, 414]],
            ["mmv.ui.tipsyDialog", "1qnjs", [413]],
            ["mmv.bootstrap", "1doho", [166, 168, 420, 197]],
            ["mmv.bootstrap.autostart", "nvgyi", [418]],
            ["mmv.head", "1vvtn", [71, 82]],
            ["ext.popups.icons", "ssyjw"],
            ["ext.popups.images", "h6mms"],
            ["ext.popups", "1iq42"],
            ["ext.popups.main", "78ftn", [421, 422, 81, 89, 71, 166, 168, 82]],
            ["ext.linter.edit", "1ekuz", [36]],
            ["socket.io", "is39l"],
            [
                "dompurify", "1q6qs"
            ],
            ["color-picker", "1qvmf"],
            ["unicodejs", "cspis"],
            ["papaparse", "17t4y"],
            ["rangefix", "f32vh"],
            ["spark-md5", "11tzz"],
            ["ext.visualEditor.supportCheck", "13m8w", [], 5],
            ["ext.visualEditor.sanitize", "jrkg8", [427, 450], 5],
            ["ext.visualEditor.progressBarWidget", "qevve", [], 5],
            ["ext.visualEditor.tempWikitextEditorWidget", "1ess5", [90, 82], 5],
            ["ext.visualEditor.desktopArticleTarget.init", "h3kjm", [435, 433, 436, 447, 36, 81, 118, 71], 5],
            ["ext.visualEditor.desktopArticleTarget.noscript", "11b6q"],
            ["ext.visualEditor.targetLoader", "mqg60", [449, 447, 36, 81, 71, 82], 5],
            ["ext.visualEditor.desktopTarget", "1stbc", [], 5],
            ["ext.visualEditor.desktopArticleTarget", "pc3gj", [453, 458, 440, 463], 5],
            ["ext.visualEditor.collabTarget", "1r80y", [451, 457, 90, 169, 218, 219], 5],
            ["ext.visualEditor.collabTarget.desktop", "v8kds", [442, 458, 440, 463], 5],
            ["ext.visualEditor.collabTarget.init", "e5yvb", [433, 169, 198], 5],
            ["ext.visualEditor.collabTarget.init.styles", "xc7ez"],
            ["ext.visualEditor.ve", "1scgz", [], 5],
            ["ext.visualEditor.track",
                "1gi8o", [446], 5
            ],
            ["ext.visualEditor.core.utils", "1d05j", [447, 198], 5],
            ["ext.visualEditor.core.utils.parsing", "1dfxr", [446], 5],
            ["ext.visualEditor.base", "lugzu", [448, 449, 429], 5],
            ["ext.visualEditor.mediawiki", "1czol", [450, 439, 34, 669], 5],
            ["ext.visualEditor.mwsave", "1q0i1", [461, 27, 50, 218], 5],
            ["ext.visualEditor.articleTarget", "1bg4j", [462, 452, 171], 5],
            ["ext.visualEditor.data", "4u8iq", [451]],
            ["ext.visualEditor.core", "1488w", [434, 433, 18, 430, 431, 432], 5],
            ["ext.visualEditor.commentAnnotation", "ufndb", [455], 5],
            ["ext.visualEditor.rebase", "w3bpk", [428, 472, 456, 224, 426], 5],
            ["ext.visualEditor.core.desktop", "4hsf8", [455], 5],
            ["ext.visualEditor.welcome", "dkuyg", [198], 5],
            ["ext.visualEditor.switching", "u0d9j", [46, 198, 210, 213, 215], 5],
            ["ext.visualEditor.mwcore", "d8bxe", [473, 451, 460, 459, 125, 69, 12, 169], 5],
            ["ext.visualEditor.mwextensions", "yfxca", [454, 484, 477, 479, 464, 481, 466, 478, 467, 469], 5],
            ["ext.visualEditor.mwextensions.desktop", "yfxca", [462, 468, 78], 5],
            ["ext.visualEditor.mwformatting", "9wsr9", [461], 5],
            [
                "ext.visualEditor.mwimage.core", "8gza1", [461], 5
            ],
            ["ext.visualEditor.mwimage", "1ac2x", [465, 183, 40, 221, 225], 5],
            ["ext.visualEditor.mwlink", "uuh66", [461], 5],
            ["ext.visualEditor.mwmeta", "11gpz", [467, 103], 5],
            ["ext.visualEditor.mwtransclusion", "1nutb", [461, 185], 5],
            ["treeDiffer", "1c337"],
            ["diffMatchPatch", "clg0b"],
            ["ext.visualEditor.checkList", "106gn", [455], 5],
            ["ext.visualEditor.diffing", "chty3", [471, 455, 470], 5],
            ["ext.visualEditor.diffPage.init.styles", "sckmm"],
            ["ext.visualEditor.diffLoader", "te1ma", [439], 5],
            ["ext.visualEditor.diffPage.init", "5603d", [475, 198, 210, 213], 5],
            ["ext.visualEditor.language", "18q5c", [455, 669, 112], 5],
            ["ext.visualEditor.mwlanguage", "1msvw", [455], 5],
            ["ext.visualEditor.mwalienextension", "1e5q0", [461], 5],
            ["ext.visualEditor.mwwikitext", "196hf", [467, 90], 5],
            ["ext.visualEditor.mwgallery", "1n1jq", [461, 116, 183, 221], 5],
            ["ext.visualEditor.mwsignature", "1hvr8", [469], 5],
            ["ext.visualEditor.experimental", "yfxca", [], 5],
            ["ext.visualEditor.icons", "yfxca", [485, 486, 211, 212, 213, 215, 216, 217, 218, 219, 222, 223, 224, 209], 5],
            ["ext.visualEditor.moduleIcons", "gy3p1"],
            ["ext.visualEditor.moduleIndicators", "1093i"],
            ["ext.citoid.visualEditor", "qwgg9", [251, 488]],
            ["ext.citoid.visualEditor.data", "1883r", [451]],
            ["ext.citoid.wikibase.init", "sypgy"],
            ["ext.citoid.wikibase", "2yehr", [489, 39, 198]],
            ["ext.templateData", "1988i"],
            ["ext.templateDataGenerator.editPage", "7lemg"],
            ["ext.templateDataGenerator.data", "rrbzo", [195]],
            ["ext.templateDataGenerator.editTemplatePage", "m7mwo", [491, 495, 493, 36, 669, 46, 202, 207, 218, 219, 222]],
            ["ext.templateData.images", "1vt0i"],
            ["ext.TemplateWizard", "1qcli", [36, 169, 172, 185, 205, 207, 218]],
            ["ext.wikiLove.icon", "a005d"],
            ["ext.wikiLove.startup", "s7s35", [39, 46, 166]],
            ["ext.wikiLove.local", "th34b"],
            ["ext.wikiLove.init", "11puo", [498]],
            ["mediawiki.libs.guiders", "1wkvo"],
            ["ext.guidedTour.styles", "1vbyw", [501, 166]],
            ["ext.guidedTour.lib.internal", "1f1ga", [84]],
            ["ext.guidedTour.lib", "wpjyv", [642, 503, 502]],
            ["ext.guidedTour.launcher", "k3952"],
            ["ext.guidedTour", "5neux", [504]],
            [
                "ext.guidedTour.tour.firstedit", "1sony", [506]
            ],
            ["ext.guidedTour.tour.test", "f32jv", [506]],
            ["ext.guidedTour.tour.onshow", "ut3ub", [506]],
            ["ext.guidedTour.tour.uprightdownleft", "1ity1", [506]],
            ["mobile.app", "e6qg3"],
            ["mobile.app.parsoid", "14q2a"],
            ["mobile.pagelist.styles", "11gl0"],
            ["mobile.pagesummary.styles", "11m0d"],
            ["mobile.messageBox.styles", "118ku"],
            ["mobile.placeholder.images", "6adt0"],
            ["mobile.userpage.styles", "17iiw"],
            ["mobile.startup.images", "1i9ol"],
            ["mobile.init.styles", "inces"],
            ["mobile.init", "k3ke9", [81, 523]],
            ["mobile.ooui.icons", "12doc"],
            ["mobile.user.icons", "18r32"],
            ["mobile.startup", "1rd1n", [37, 119, 196, 71, 44, 166, 168, 82, 85, 515, 521, 513, 514, 516, 518]],
            ["mobile.editor.overlay", "158x8", [48, 90, 64, 167, 171, 525, 523, 522, 198, 215]],
            ["mobile.editor.images", "1c6j4"],
            ["mobile.talk.overlays", "ly65j", [165, 524]],
            ["mobile.mediaViewer", "13w7m", [523]],
            ["mobile.categories.overlays", "14vke", [524, 218]],
            ["mobile.languages.structured", "11i28", [523]],
            ["mobile.special.mobileoptions.styles", "1o7yg"],
            [
                "mobile.special.mobileoptions.scripts", "1ubf5", [523]
            ],
            ["mobile.special.nearby.styles", "1qj93"],
            ["mobile.special.userlogin.scripts", "131g5"],
            ["mobile.special.nearby.scripts", "1vs6p", [81, 532, 523]],
            ["mobile.special.mobilediff.images", "1uhuh"],
            ["skins.minerva.base.styles", "1axgo"],
            ["skins.minerva.content.styles", "zzyf8"],
            ["skins.minerva.content.styles.images", "t2824"],
            ["skins.minerva.icons.loggedin", "1p7qj"],
            ["skins.minerva.amc.styles", "1tmdg"],
            ["skins.minerva.overflow.icons", "4h6wj"],
            ["skins.minerva.icons.wikimedia", "4erqk"],
            ["skins.minerva.icons.images.scripts", "yfxca", [544, 546, 547, 545]],
            ["skins.minerva.icons.images.scripts.misc", "10cli"],
            ["skins.minerva.icons.page.issues.uncolored", "6lpb0"],
            ["skins.minerva.icons.page.issues.default.color", "1oef7"],
            ["skins.minerva.icons.page.issues.medium.color", "lfald"],
            ["skins.minerva.mainPage.styles", "1ojsg"],
            ["skins.minerva.userpage.styles", "yy1aw"],
            ["skins.minerva.talk.styles", "1e3g4"],
            ["skins.minerva.personalMenu.icons", "1e270"],
            [
                "skins.minerva.mainMenu.advanced.icons", "d7ilx"
            ],
            ["skins.minerva.mainMenu.icons", "1eoif"],
            ["skins.minerva.mainMenu.styles", "1y06x"],
            ["skins.minerva.loggedin.styles", "2waqb"],
            ["skins.minerva.scripts", "1t8q4", [81, 89, 165, 523, 543, 553, 554]],
            ["skins.minerva.options", "1pw3i", [556]],
            ["ext.math.styles", "19kfl"],
            ["ext.math.scripts", "10354"],
            ["ext.math.wikibase.scripts", "1f29v", ["jquery.wikibase.entityselector"]],
            ["ext.math.visualEditor", "1lao9", [558, 461]],
            ["ext.math.visualEditor.mathSymbolsData", "ck829", [561]],
            ["ext.math.visualEditor.mathSymbols", "1a66r", [562]],
            ["ext.math.visualEditor.chemSymbolsData", "ar9ku", [561]],
            ["ext.math.visualEditor.chemSymbols", "1rg9e", [564]],
            ["ext.babel", "1ordw"],
            ["ext.vipsscaler", "2nfqj", [568]],
            ["jquery.ucompare", "1fqic"],
            ["mediawiki.template.underscore", "i9pgt", [570, 43]],
            ["ext.pageTriage.external", "1dx4b"],
            ["jquery.badge.external", "1rsmh"],
            ["ext.pageTriage.init", "tyfw6", [570]],
            ["ext.pageTriage.util", "bemn8", [572, 81, 82]],
            ["jquery.tipoff", "1tdpu"],
            [
                "ext.pageTriage.views.list", "tpk2g", [573, 30, 574, 39, 569]
            ],
            ["ext.pageTriage.defaultTagsOptions", "gjzeg"],
            ["ext.pageTriage.externalTagsOptions", "22h6x", [576]],
            ["ext.pageTriage.defaultDeletionTagsOptions", "1n92c", [72]],
            ["ext.pageTriage.externalDeletionTagsOptions", "fad2j", [578]],
            ["ext.pageTriage.toolbarStartup", "1v26q", [572]],
            ["ext.pageTriage.article", "10ott", [572, 81, 46]],
            ["ext.PageTriage.enqueue", "p9bzi", [84]],
            ["ext.interwiki.specialpage", "1orww"],
            ["ext.echo.logger", "12wz2", [82, 195]],
            ["ext.echo.ui.desktop", "1l7e6", [591, 586]],
            ["ext.echo.ui", "1nl3k", [587, 584, 958, 202, 211, 212, 218, 222, 223, 224]],
            ["ext.echo.dm", "occy4", [590, 40]],
            ["ext.echo.api", "xc75x", [54]],
            ["ext.echo.mobile", "z826o", [586, 196, 44]],
            ["ext.echo.init", "vitqh", [588]],
            ["ext.echo.styles.badge", "1r4em"],
            ["ext.echo.styles.notifications", "6h4hf"],
            ["ext.echo.styles.alert", "1jdxe"],
            ["ext.echo.special", "1alsb", [595, 586]],
            ["ext.echo.styles.special", "tjyvs"],
            ["ext.thanks.images", "8zb67"],
            ["ext.thanks", "1rf02", [46, 88]],
            ["ext.thanks.corethank",
                "cy9fg", [597, 20, 207]
            ],
            ["ext.thanks.mobilediff", "uj81m", [596, 523]],
            ["ext.thanks.flowthank", "27pp1", [597, 207]],
            ["ext.disambiguator.visualEditor", "i70is", [468]],
            ["ext.discussionTools.init.styles", "1jnes"],
            ["ext.discussionTools.init", "1dqbq", [449, 72, 81, 101, 88, 71, 40, 207, 431]],
            ["ext.discussionTools.debug", "1kam1", [603]],
            ["ext.discussionTools.ReplyWidget", "1tjgs", [951, 603, 171, 174, 202]],
            ["ext.discussionTools.ReplyWidgetPlain", "tyxck", [605, 90, 82]],
            ["ext.discussionTools.ReplyWidgetVisual", "1qft5", [605, 458, 440, 463, 482, 480]],
            ["ext.codeEditor", "otfyp", [609], 4],
            ["jquery.codeEditor", "16ua9", [611, 610, 390, 207], 4],
            ["ext.codeEditor.icons", "th89k"],
            ["ext.codeEditor.ace", "tmo5p", [], 6],
            ["ext.codeEditor.ace.modes", "126r1", [611], 6],
            ["ext.scribunto.errors", "l25w2", [39]],
            ["ext.scribunto.logs", "1pp6c"],
            ["ext.scribunto.edit", "18zsh", [30, 46]],
            ["ext.guidedTour.tour.gettingstartedtasktoolbar", "1vvji", [617, 506, 81]],
            ["ext.gettingstarted.logging", "13uer", [101, 82]],
            ["ext.gettingstarted.api", "28cgd", [46]],
            [
                "ext.gettingstarted.taskToolbar", "11nd6", [618, 617, 504, 37]
            ],
            ["ext.gettingstarted.return", "f175j", [618, 617, 504, 81]],
            ["ext.relatedArticles.cards", "1r9dz", [622, 84, 195]],
            ["ext.relatedArticles.lib", "1hqfc"],
            ["ext.relatedArticles.readMore.gateway", "pz3on", [195]],
            ["ext.relatedArticles.readMore.bootstrap", "uqvo5", [623, 81, 89, 82, 85]],
            ["ext.relatedArticles.readMore", "aeemx", [84]],
            ["ext.RevisionSlider.lazyCss", "2ft4x"],
            ["ext.RevisionSlider.lazyJs", "8ah63", [630, 223]],
            ["ext.RevisionSlider.init", "1ufov", [633, 630, 632, 222]],
            ["ext.RevisionSlider.noscript", "1jaz7"],
            ["ext.RevisionSlider.Settings", "1ibe0", [71, 82]],
            ["ext.RevisionSlider.Pointer", "lks7m"],
            ["ext.RevisionSlider.Slider", "q35fc", [634, 631, 39, 81, 223]],
            ["ext.RevisionSlider.RevisionList", "13xys", [40, 198]],
            ["ext.RevisionSlider.HelpDialog", "y42gj", [635, 198, 218]],
            ["ext.RevisionSlider.dialogImages", "lcf7b"],
            ["ext.TwoColConflict.SplitJs", "zva9r", [639, 640]],
            ["ext.TwoColConflict.SplitCss", "1qwpr"],
            ["ext.TwoColConflict.Split.TourImages", "5rpqo"],
            [
                "ext.TwoColConflict.Split.Tour", "rsxef", [638, 69, 71, 82, 198, 218]
            ],
            ["ext.TwoColConflict.Util", "9felx"],
            ["ext.TwoColConflict.JSCheck", "srrl2"],
            ["ext.eventLogging", "wk3r3", [82]],
            ["ext.eventLogging.debug", "148e2"],
            ["ext.eventLogging.jsonSchema", "1d66w"],
            ["ext.eventLogging.jsonSchema.styles", "1b8ci"],
            ["ext.wikimediaEvents", "q9m5q", [642, 81, 89, 71]],
            ["ext.wikimediaEvents.wikibase", "19zou"],
            ["ext.navigationTiming", "kflv9", [642]],
            ["ext.navigationTiming.rumSpeedIndex", "hbh0o"],
            ["ext.uls.common", "1rv90", [669, 71, 82]],
            ["ext.uls.compactlinks", "19ik9", [650, 166]],
            ["ext.uls.displaysettings", "1ozg9", [961, 658, 163, 164]],
            ["ext.uls.geoclient", "vzi6q", [88]],
            ["ext.uls.i18n", "148k0", [26, 84]],
            ["ext.uls.interface", "d3ran", [664, 71]],
            ["ext.uls.interlanguage", "d776l"],
            ["ext.uls.languagenames", "17cvc"],
            ["ext.uls.languagesettings", "1t8as", [660, 661, 670, 166]],
            ["ext.uls.mediawiki", "105u5", [650, 657, 660, 664, 668]],
            ["ext.uls.messages", "dudyy", [654]],
            ["ext.uls.preferences", "7zqwu", [82]],
            ["ext.uls.preferencespage", "ej2j1"],
            [
                "ext.uls.pt", "1lwz2"
            ],
            ["ext.uls.webfonts", "ba535", [661]],
            ["ext.uls.webfonts.fonts", "yfxca", [666, 671]],
            ["ext.uls.webfonts.repository", "va8oi"],
            ["jquery.ime", "yhayl"],
            ["jquery.uls", "10ff4", [26, 669, 670]],
            ["jquery.uls.data", "fp01b"],
            ["jquery.uls.grid", "1mcjl"],
            ["jquery.webfonts", "1bzjx"],
            ["rangy.core", "177e2"],
            ["ext.cx.contributions", "1osqk", [84, 199, 212, 213]],
            ["ext.cx.model", "1hxxp"],
            ["ext.cx.feedback", "1lhci", [674]],
            ["ext.cx.dashboard", "egud3", [675, 712, 683, 699, 739, 742, 221]],
            ["mw.cx3", "jhzo2", [681, 679]],
            ["ext.cx.util", "11e1j", [674]],
            ["mw.cx.util", "1bmk0", [674, 82]],
            ["ext.cx.util.selection", "m2jbs", [674]],
            ["mw.cx.SiteMapper", "1xhwo", [674, 54, 82]],
            ["ext.cx.source", "1uqpn", [678, 710, 669, 81, 12, 82]],
            ["mw.cx.SourcePageSelector", "655fi", [684, 763]],
            ["mw.cx.SelectedSourcePage", "1ya25", [708, 33, 685, 213]],
            ["mw.cx.ui.LanguageFilter", "rtqr2", [659, 166, 718, 679, 218]],
            ["ext.cx.translation", "12fwm", [708, 687, 680, 669, 199]],
            ["ext.cx.translation.progress", "1c31v", [678]],
            ["ext.cx.tools.manager", "13l8d"],
            [
                "ext.cx.tools", "7mgvo", [675, 690, 688, 678, 680, 709, 710, 669, 71, 681, 759]
            ],
            ["ext.cx.progressbar", "anmhi", [110]],
            ["ext.cx.translation.loader", "10zha", [674, 82]],
            ["ext.cx.translation.storage", "5fdb6", [46, 194, 199]],
            ["ext.cx.publish", "156z9", [695, 708, 194]],
            ["ext.cx.wikibase.link", "4nhqv"],
            ["ext.cx.publish.dialog", "1mddp", [681]],
            ["ext.cx.eventlogging.campaigns", "1b43b", [82]],
            ["ext.cx.interlanguagelink.init", "19har", [650]],
            ["ext.cx.interlanguagelink", "966xn", [678, 650, 681, 202, 218]],
            ["mw.cx.dashboard.lists", "pki9b", [690, 678, 710, 169, 40, 685, 215, 222]],
            ["ext.cx.translation.conflict", "pkbiz", [110]],
            ["ext.cx.stats", "1pbjt", [702, 678, 711, 710, 669, 40, 681, 739]],
            ["chart.js", "hr823"],
            ["ext.cx.entrypoints.newarticle", "13uqq", [711, 166, 84, 199]],
            ["ext.cx.entrypoints.newarticle.veloader", "lrbq7"],
            ["ext.cx.entrypoints.newbytranslation", "14m2q", [681, 679, 202, 212, 218]],
            ["ext.cx.betafeature.init", "10gyo"],
            ["ext.cx.entrypoints.contributionsmenu", "6ubsn", [711, 110]],
            ["ext.cx.tools.validator", "1gqqx", [681]],
            [
                "ext.cx.widgets.overlay", "ydx19", [674]
            ],
            ["ext.cx.widgets.spinner", "1ib96", [674]],
            ["ext.cx.widgets.callout", "1sksh"],
            ["ext.cx.widgets.translator", "8ut7j", [674, 46]],
            ["mw.cx.dm", "1wmye", [674, 195]],
            ["mw.cx.dm.Translation", "3ditv", [713]],
            ["mw.cx.dm.WikiPage", "17pnl", [669, 713]],
            ["mw.cx.dm.TranslationIssue", "1myvi", [713]],
            ["mw.cx.dm.PageTitleModel", "2scqv", [727]],
            ["mw.cx.ui", "4mfh7", [674, 198]],
            ["mw.cx.visualEditor", "yfxca", [724, 723, 722, 721, 725, 720]],
            ["mw.cx.visualEditor.sentence", "g4r6p", [728]],
            ["mw.cx.visualEditor.publishSettings", "1dsx6", [455]],
            ["mw.cx.visualEditor.mt", "1c40w", [728]],
            ["mw.cx.visualEditor.link", "10g2a", [728]],
            ["mw.cx.visualEditor.content", "1bsm3", [728]],
            ["mw.cx.visualEditor.section", "g3v9d", [728, 726, 727]],
            ["ve.ce.CXLintableNode", "1gbl4", [455]],
            ["ve.dm.CXLintableNode", "mnuhz", [455, 716]],
            ["mw.cx.visualEditor.base", "1hbs4", [458, 440, 463]],
            ["mw.cx.init", "lksky", [732, 731, 715, 730]],
            ["mw.cx.init.Translation", "de18n", [194, 748, 734, 733]],
            ["mw.cx.MwApiRequestManager", "n3rx7", [733]],
            [
                "mw.cx.MachineTranslation", "iii2v", [674, 71]
            ],
            ["ve.init.mw.CXTarget", "trr5a", [678, 681, 714, 751, 679, 736, 735]],
            ["mw.cx.ui.TranslationView", "2uao8", [710, 681, 717, 753, 739, 742, 760]],
            ["ve.ui.CXSurface", "7szje", [458]],
            ["ve.ui.CXDesktopContext", "3wahs", [458]],
            ["mw.cx.ui.TranslationView.legacy", "ecck9", [678, 681, 743, 740, 761]],
            ["mw.cx.init.legacy", "1a2aw", [737]],
            ["mw.cx.ui.Header", "agh8w", [764, 224, 225]],
            ["mw.cx.ui.Header.legacy", "1wt4o", [742, 764, 224, 225]],
            ["mw.cx.ui.Header.skin", "1lwlc"],
            ["mw.cx.ui.Infobar", "q5d3a", [762, 679]],
            ["mw.cx.ui.Columns.legacy", "ljsb4", [744, 746, 745]],
            ["mw.cx.ui.SourceColumn.legacy", "12e9u", [710, 718]],
            ["mw.cx.ui.TranslationColumn.legacy", "11k0z", [710, 718]],
            ["mw.cx.ui.ToolsColumn.legacy", "1um86", [718]],
            ["mw.cx.ui.CategoryMultiselectWidget", "1hwzr", [468, 718]],
            ["mw.cx.ui.Categories", "9t0i7", [714, 747]],
            ["mw.cx.ui.CaptchaDialog", "n3jl4", [963, 718]],
            ["mw.cx.ui.LoginDialog", "1l0pg", [84, 718]],
            ["mw.cx.tools.TranslationToolFactory", "1o2sd", [718]],
            ["mw.cx.tools", "yfxca", [756, 755, 754]],
            [
                "mw.cx.tools.IssueTrackingTool", "nhlml", [757]
            ],
            ["mw.cx.tools.TemplateTool", "z6brg", [757]],
            ["mw.cx.tools.SearchTool", "1bgdu", [757]],
            ["mw.cx.tools.InstructionsTool", "u3sgu", [110, 757, 44]],
            ["mw.cx.tools.TranslationTool", "5a0mf", [758]],
            ["mw.cx.ui.TranslationToolWidget", "f0dsl", [718]],
            ["mw.cx.widgets.TemplateParamOptionWidget", "5s1sy", [718]],
            ["mw.cx.ui.PageTitleWidget", "17mxm", [718, 679, 726]],
            ["mw.cx.ui.PublishSettingsWidget", "s4uyo", [718, 218]],
            ["mw.cx.ui.MessageWidget", "158w8", [718, 211, 218]],
            ["mw.cx.ui.PageSelectorWidget", "1tex1", [669, 169, 681, 718, 218]],
            ["mw.cx.ui.PersonalMenuWidget", "hk536", [82, 169, 718]],
            ["mw.cx.ui.FeatureDiscoveryWidget", "13b4k", [69, 718]],
            ["mw.cx.skin", "j801g"],
            ["mw.externalguidance.init", "13824", [81]],
            ["mw.externalguidance", "y2f5c", [54, 523, 769, 215]],
            ["mw.externalguidance.icons", "1vhjz"],
            ["mw.externalguidance.special", "1nw9t", [669, 54, 164, 523, 769]],
            ["wikibase.client.init", "lnemg"],
            ["wikibase.client.miscStyles", "78ef6"],
            ["wikibase.client.linkitem.init", "1jnmb", [30]],
            [
                "jquery.wikibase.linkitem", "1muq6", [30, 38, 39, 54, 843, 842, 967]
            ],
            ["wikibase.client.action.edit.collapsibleFooter", "154an", [28, 62, 71]],
            ["ext.wikimediaBadges", "h9x7n"],
            ["ext.TemplateSandbox.top", "1y9qm"],
            ["ext.TemplateSandbox", "54oct", [777]],
            ["ext.pageassessments.special", "1gk8u", [33, 199]],
            ["ext.jsonConfig", "r7phl"],
            ["ext.jsonConfig.edit", "1xjp4", [36, 184, 207]],
            ["ext.graph.styles", "70wqq"],
            ["ext.graph.data", "lnpu6"],
            ["ext.graph.loader", "htqnv", [46]],
            ["ext.graph.vega1", "1gmql", [783, 81]],
            ["ext.graph.vega2", "quuuh", [783, 81]],
            ["ext.graph.sandbox", "14wa6", [608, 786, 48]],
            ["ext.graph.visualEditor", "b6yln", [783, 465, 184]],
            ["ext.MWOAuth.styles", "fns5c"],
            ["ext.MWOAuth.AuthorizeDialog", "mglmv", [39]],
            ["ext.oath.totp.showqrcode", "1cqri"],
            ["ext.oath.totp.showqrcode.styles", "12n03"],
            ["ext.webauthn.ui.base", "1yb87", [110, 198]],
            ["ext.webauthn.register", "zo5hv", [793, 46]],
            ["ext.webauthn.login", "t59zw", [793]],
            ["ext.webauthn.manage", "joowb", [793, 46]],
            ["ext.webauthn.disable", "1fsj5", [793]],
            ["ext.ores.highlighter",
                "1w2wg"
            ],
            ["ext.ores.styles", "4bjhs"],
            ["ext.ores.specialoresmodels.styles", "wpuaz"],
            ["ext.ores.api", "l9d3n"],
            ["ext.checkUser", "12me9", [34, 81, 71, 169, 213, 215, 218, 220, 222, 224]],
            ["ext.checkUser.styles", "13js5"],
            ["ext.guidedTour.tour.checkuserinvestigateform", "1r7uv", [506]],
            ["ext.guidedTour.tour.checkuserinvestigate", "1aysm", [802, 506]],
            ["ext.quicksurveys.lib", "1k5e9", [642, 81, 89, 71, 85, 202]],
            ["ext.quicksurveys.init", "1ggqp"],
            ["ext.kartographer", "xr7un"],
            ["ext.kartographer.style", "yqx78"],
            ["ext.kartographer.site", "1jxyp"],
            ["mapbox", "pfzud"],
            ["leaflet.draw", "15217", [811]],
            ["ext.kartographer.link", "w48bu", [815, 196]],
            ["ext.kartographer.box", "dhr76", [816, 827, 810, 809, 819, 81, 46, 221]],
            ["ext.kartographer.linkbox", "19jya", [819]],
            ["ext.kartographer.data", "1lw6k"],
            ["ext.kartographer.dialog", "1jplo", [811, 196, 202, 207, 218]],
            ["ext.kartographer.dialog.sidebar", "11gi8", [71, 218, 223]],
            ["ext.kartographer.util", "2hxgp", [808]],
            ["ext.kartographer.frame", "zrgfa", [814, 196]],
            ["ext.kartographer.staticframe", "xrggf", [815,
                196, 221
            ]],
            ["ext.kartographer.preview", "6l39b"],
            ["ext.kartographer.editing", "qvghu", [46]],
            ["ext.kartographer.editor", "yfxca", [814, 812]],
            ["ext.kartographer.visualEditor", "1j47g", [819, 461, 37, 220]],
            ["ext.kartographer.lib.prunecluster", "7wzxn", [811]],
            ["ext.kartographer.lib.topojson", "d8h09", [811]],
            ["ext.kartographer.wv", "1vmzn", [826, 215]],
            ["ext.kartographer.specialMap", "gqd57"],
            ["ext.pageviewinfo", "h3trn", [786, 198]],
            ["three.js", "1uoe7"],
            ["ext.3d", "1efrb", [30]],
            ["ext.3d.styles", "1rrwr"],
            ["mmv.3d", "1okh4", [832, 413, 831]],
            ["mmv.3d.head", "1gb1d", [832, 199, 210, 212]],
            ["ext.3d.special.upload", "l1rr1", [837, 150]],
            ["ext.3d.special.upload.styles", "tsx5r"],
            ["ext.GlobalPreferences.global", "11pcu", [169, 177, 186]],
            ["ext.GlobalPreferences.global-nojs", "1ivhq"],
            ["ext.GlobalPreferences.local", "3dqkc", [177]],
            ["ext.GlobalPreferences.local-nojs", "qbqct"],
            ["mw.config.values.wbSiteDetails", "nku6b"],
            ["mw.config.values.wbRepo", "18viq"],
            ["ext.centralauth.globalrenamequeue", "13dot"],
            [
                "ext.centralauth.globalrenamequeue.styles", "19ks0"
            ],
            ["ext.geshi.visualEditor", "1bcan", [461]],
            ["ext.gadget.modrollback", "m8kr7", [], 2],
            ["ext.gadget.confirmationRollback-mobile", "zn9v3", [84], 2],
            ["ext.gadget.removeAccessKeys", "flxv8", [4, 84], 2],
            ["ext.gadget.searchFocus", "1kcxw", [], 2],
            ["ext.gadget.GoogleTrans", "i9xpb", [], 2],
            ["ext.gadget.ImageAnnotator", "2l1dy", [], 2],
            ["ext.gadget.imagelinks", "kqsvu", [84], 2],
            ["ext.gadget.Navigation_popups", "xcjhi", [82], 2],
            ["ext.gadget.exlinks", "1yffr", [84], 2],
            ["ext.gadget.search-new-tab", "125v5", [], 2],
            ["ext.gadget.PrintOptions", "v4oe9", [], 2],
            ["ext.gadget.revisionjumper", "13grk", [], 2],
            ["ext.gadget.Twinkle", "d75ii", [860, 862], 2],
            ["ext.gadget.morebits", "19r3u", [82, 39], 2],
            ["ext.gadget.Twinkle-pagestyles", "f2uwn", [], 2],
            ["ext.gadget.select2", "1cqa0", [], 2],
            ["ext.gadget.HideFundraisingNotice", "1nofe", [], 2],
            ["ext.gadget.HideCentralNotice", "gz251", [], 2],
            ["ext.gadget.ReferenceTooltips", "h3097", [88, 18], 2],
            ["ext.gadget.formWizard", "17lv5", [], 2],
            ["ext.gadget.formWizard-core", "sb9bm", [162, 82, 17, 39], 2],
            ["ext.gadget.responsiveContentBase", "12zj3", [], 2],
            ["ext.gadget.responsiveContentBaseTimeless", "m81li", [], 2],
            ["ext.gadget.Prosesize", "vd3i0", [46], 2],
            ["ext.gadget.find-archived-section", "197t0", [], 2],
            ["ext.gadget.geonotice", "1qoax", [], 2],
            ["ext.gadget.geonotice-core", "1a0z7", [84, 71], 2],
            ["ext.gadget.watchlist-notice", "fams1", [], 2],
            ["ext.gadget.watchlist-notice-core", "1vpku", [71], 2],
            ["ext.gadget.WatchlistBase", "nprfs", [], 2],
            ["ext.gadget.WatchlistGreenIndicators", "uzix8", [], 2],
            ["ext.gadget.WatchlistGreenIndicatorsMono", "1vcwo", [], 2],
            ["ext.gadget.WatchlistChangesBold", "x4gb0", [], 2],
            ["ext.gadget.SubtleUpdatemarker", "szsh3", [], 2],
            ["ext.gadget.defaultsummaries", "1t9q2", [199], 2],
            ["ext.gadget.citations", "gcgfn", [84], 2],
            ["ext.gadget.DotsSyntaxHighlighter", "1h0h4", [], 2],
            ["ext.gadget.HotCat", "1algn", [], 2],
            ["ext.gadget.wikEdDiff", "zpf2j", [], 2],
            ["ext.gadget.ProveIt", "1lcna", [], 2],
            ["ext.gadget.ProveIt-classic", "rkfnt", [39, 36, 84], 2],
            ["ext.gadget.Shortdesc-helper", "z998f", [46,
                890
            ], 2],
            ["ext.gadget.Shortdesc-helper-pagestyles-vector", "ptc7r", [], 2],
            ["ext.gadget.libSettings", "10w9o", [7], 2],
            ["ext.gadget.wikEd", "1ehfq", [36, 7], 2],
            ["ext.gadget.afchelper", "1tbzl", [82, 17], 2],
            ["ext.gadget.charinsert", "1vxzq", [], 2],
            ["ext.gadget.charinsert-core", "1xb95", [36, 4, 71], 2],
            ["ext.gadget.legacyToolbar", "180rf", [], 2],
            ["ext.gadget.extra-toolbar-buttons", "1rdtw", [], 2],
            ["ext.gadget.extra-toolbar-buttons-core", "cpsse", [], 2],
            ["ext.gadget.refToolbar", "1hiau", [7, 84], 2],
            ["ext.gadget.refToolbarBase", "15bvu", [], 2],
            ["ext.gadget.script-installer", "1rz9u", [], 2],
            ["ext.gadget.edittop", "18hj0", [7, 84], 2],
            ["ext.gadget.UTCLiveClock", "lfyjd", [46], 2],
            ["ext.gadget.UTCLiveClock-pagestyles", "1ch76", [], 2],
            ["ext.gadget.purgetab", "hslwv", [46], 2],
            ["ext.gadget.ExternalSearch", "nf3zp", [], 2],
            ["ext.gadget.CollapsibleNav", "19ziu", [21], 2],
            ["ext.gadget.MenuTabsToggle", "kicd7", [88], 2],
            ["ext.gadget.dropdown-menus", "1edag", [46], 2],
            ["ext.gadget.dropdown-menus-pagestyles", "755tc", [], 2],
            ["ext.gadget.CategoryAboveAll",
                "k0g79", [], 2
            ],
            ["ext.gadget.addsection-plus", "11kgg", [], 2],
            ["ext.gadget.CommentsInLocalTime", "2t3l2", [], 2],
            ["ext.gadget.OldDiff", "1x32c", [], 2],
            ["ext.gadget.NoAnimations", "y4mrp", [], 2],
            ["ext.gadget.disablesuggestions", "1b1l2", [], 2],
            ["ext.gadget.NoSmallFonts", "1gtz5", [], 2],
            ["ext.gadget.topalert", "1a54z", [], 2],
            ["ext.gadget.metadata", "1ptth", [84], 2],
            ["ext.gadget.JustifyParagraphs", "ryzph", [], 2],
            ["ext.gadget.righteditlinks", "z7u80", [], 2],
            ["ext.gadget.PrettyLog", "fyswo", [84], 2],
            ["ext.gadget.switcher", "155lf", [], 2],
            ["ext.gadget.SidebarTranslate", "zc5rm", [], 2],
            ["ext.gadget.Blackskin", "1ra1b", [], 2],
            ["ext.gadget.VectorClassic", "16fzl", [], 2],
            ["ext.gadget.widensearch", "1bwkh", [], 2],
            ["ext.gadget.DisambiguationLinks", "iu5kl", [], 2],
            ["ext.gadget.markblocked", "rk3ow", [118], 2],
            ["ext.gadget.responsiveContent", "1a6ay", [], 2],
            ["ext.gadget.responsiveContentTimeless", "kihss", [], 2],
            ["ext.gadget.HideInterwikiSearchResults", "3xbpc", [], 2],
            ["ext.gadget.XTools-ArticleInfo", "1ht5x", [], 2],
            [
                "ext.gadget.RegexMenuFramework", "xtf8z", [], 2
            ],
            ["ext.gadget.ShowMessageNames", "lxtkz", [84], 2],
            ["ext.gadget.DebugMode", "pa6gq", [84], 2],
            ["ext.gadget.contribsrange", "uqldp", [84, 30], 2],
            ["ext.gadget.BugStatusUpdate", "1dur1", [], 2],
            ["ext.gadget.RTRC", "r3h5z", [], 2],
            ["ext.gadget.XFDcloser", "1489v", [82], 2],
            ["ext.gadget.XFDcloser-core", "1f4d0", [202, 207, 942, 860], 2],
            ["ext.gadget.XFDcloser-core-beta", "3b9mw", [46, 202, 207, 218, 212, 222, 211, 942], 2],
            ["ext.gadget.libExtraUtil", "1ig7s", [], 2],
            ["ext.gadget.mobile-sidebar", "1ujyz", [], 2],
            ["ext.gadget.addMe", "1frrt", [], 2],
            ["ext.gadget.NewImageThumb", "1wzn6", [], 2],
            ["ext.gadget.StickyTableHeaders", "147fz", [], 2],
            ["ext.gadget.ShowJavascriptErrors", "l317n", [], 2],
            ["ext.gadget.PageDescriptions", "3s3iv", [46], 2],
            ["ext.gadget.libLua", "1yyjo", [46], 2],
            ["ext.gadget.libSensitiveIPs", "1l2zu", [949], 2],
            ["ext.confirmEdit.CaptchaInputWidget", "4hoeq", [199]],
            ["ext.globalCssJs.user", "qvuzj", [], 0, "metawiki"],
            ["ext.globalCssJs.user.styles", "qvuzj", [], 0, "metawiki"],
            ["pdfhandler.messages", "1p1tq"],
            ["ext.guidedTour.tour.firsteditve", "142cg", [506]],
            ["ext.pageTriage.views.toolbar", "inru6", [579, 577, 573, 500, 571, 30, 968, 211, 569]],
            ["ext.echo.emailicons", "10peg"],
            ["ext.echo.secondaryicons", "1mrog"],
            ["ext.guidedTour.tour.gettingstartedtasktoolbarve", "1v4ec", [617, 506]],
            ["ext.wikimediaEvents.visualEditor", "1pioh", [439]],
            ["ext.uls.ime", "quw36", [659, 667]],
            ["ext.uls.setlang", "1p7o7", [81, 46, 166]],
            ["mw.cx.externalmessages", "1ym2z"],
            ["ext.guidedTour.tour.RcFiltersIntro", "qr9ss", [506]],
            ["ext.guidedTour.tour.WlFiltersIntro", "deakl", [506]],
            ["ext.guidedTour.tour.RcFiltersHighlight", "y8ymp", [506]],
            ["wikibase.Site", "9d40m", [659]],
            ["mediawiki.messagePoster", "1wtgm", [54]]
        ]);
        mw.config.set(window.RLCONF || {});
        mw.loader.state(window.RLSTATE || {});
        mw.loader.load(window.RLPAGEMODULES || []);
        queue = window.RLQ || [];
        RLQ = [];
        RLQ.push = function(fn) {
            if (typeof fn === 'function') {
                fn();
            } else {
                RLQ[RLQ.length] = fn;
            }
        };
        while (queue[0]) {
            RLQ.push(queue.shift());
        }
        NORLQ = {
            push: function() {}
        };
    }());
}