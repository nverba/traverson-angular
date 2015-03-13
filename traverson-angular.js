/* global angular */
'use strict';

var traverson = require('traverson');

var ng;
if (typeof angular !== 'undefined') {
  // angular is defined globally, use this
  ng = angular;
} else {
  // angular is not defined globally, try to require it
  ng = require('angular');
  if (typeof ng.module !== 'function') {
    throw new Error('angular has either to be provided globally or made ' +
        'available as a shim for browserify. (Also, if the angular module on ' +
        'npm would actually be a proper CommonJS module, this error ' +
        'wouldn\'t be a thing.)');
  }
}

var traversonAngular = ng.module('traverson', []);

traversonAngular.factory('traverson', ['$q', function traversonFactory($q) {
  var Builder = traverson._Builder;
  var originalMethods = {
    get: Builder.prototype.get,
    getResource: Builder.prototype.getResource,
    getUri: Builder.prototype.getUri,
    post: Builder.prototype.post,
    put: Builder.prototype.put,
    patch: Builder.prototype.patch,
    delete: Builder.prototype.delete,
  };

  function promisify(that, originalMethod, argsArray) {
    var deferred = $q.defer();

    argsArray = argsArray || [];

    var callback = function(err, result, uri) {
      if (err) {
        err.result = result;
        err.uri = uri;
        deferred.reject(err);
      } else {
        deferred.resolve(result);
      }
    };

    argsArray.push(callback);

    var traversal = originalMethod.apply(that, argsArray);

    // TODO What we actually want is
    // return {
    //   result: deferred.promise,
    //   abort: traversal.abort;
    // };
    //
    // - that is, return an object that only has two properties
    // (result: the promise, abort: the function to abort the traversal) but
    // that would break clients, which rely on the returned value being the
    // promise. Have to wait until next breaking relase (2.0.0) to change that.
    // For now, we return the promise directly, but also tack the properties
    // result (again, the promise, attached to itself) and abort (the function
    // to abort the traversal) to it.
    var returnValue = deferred.promise;
    returnValue.result = deferred.promise;
    returnValue.abort = traversal.abort;
    return returnValue;
  }

  Builder.prototype.get = function() {
    return promisify(this, originalMethods.get);
  };

  Builder.prototype.getResource = function() {
    return promisify(this, originalMethods.getResource);
  };

  Builder.prototype.getUri = function() {
    return promisify(this, originalMethods.getUri);
  };

  Builder.prototype.post = function(body) {
    return promisify(this, originalMethods.post, [body]);
  };

  Builder.prototype.put = function(body) {
    return promisify(this, originalMethods.put, [body]);
  };

  Builder.prototype.patch = function(body) {
    return promisify(this, originalMethods.patch, [body]);
  };

  Builder.prototype.delete = Builder.prototype.del = function() {
    return promisify(this, originalMethods.delete);
  };

  return traverson;
}]);


traversonAngular.factory('$httpTraversonAdapter', [
  '$http', function $httpTraversonAdapterFactory($http) {

    function Request() { }

    Request.prototype.get = function(uri, options, callback) {
      return $http.get(uri, mapOptions(options))
        .then(handleResponse(callback))
        .catch(handleError(callback));
    };

    Request.prototype.post = function(uri, options, callback) {
      return $http.post(uri, mapOptions(options))
        .then(handleResponse(callback))
        .catch(handleError(callback));
    };

    Request.prototype.put = function(uri, options, callback) {
      return $http.put(uri, mapOptions(options))
        .then(handleResponse(callback))
        .catch(handleError(callback));
    };

    Request.prototype.patch = function(uri, options, callback) {
      return $http.patch(uri, mapOptions(options))
        .then(handleResponse(callback))
        .catch(handleError(callback));
    };

    Request.prototype.del = function(uri, options, callback) {
      return $http.delete(uri, mapOptions(options))
        .then(handleResponse(callback))
        .catch(handleError(callback));
    };

    function mapOptions(options) {
      options = options || {};
      var newOptions = {};
      mapQuery(newOptions, options);
      mapHeaders(newOptions, options);
      mapAuth(newOptions, options);
      mapBody(newOptions, options);
      mapForm(newOptions, options);
      return newOptions;
    }

    function mapQuery(newOptions, options) {
      newOptions.params = options.query;
    }

    function mapHeaders(newOptions, options) {
      newOptions.headers || (newOptions.headers = {});
    }

    function mapAuth(newOptions, options) {
      var auth = options.auth;
      if (auth) {
        var username = auth.user || auth.username;
        var password = auth.pass || auth.password;
        newOptions.headers || (newOptions.headers = {});
        newOptions.headers.Authorization = 'Basic ' + username + ':' + password;
      }
    }

    function mapBody(newOptions, options) {
      var body = options.body;
      if (body) {
        newOptions.data = body;
      }
    }

    function mapForm(newOptions, options) {
      var form = options.form;
      if (form) {
        newOptions.data = form;
        newOptions.headers || (newOptions.headers = {});
        newOptions.headers['Content-Type'] =
          'application/x-www-form-urlencoded';
      }
    }

    function mapResponse(response) {
      response.body = response.data;
      response.statusCode = response.status;
      return response;
    }

    function handleResponse(callback) {
      return function(response) {
        return callback(null, mapResponse(response));
      };
    }

    function handleError(callback) {
      return function(err) {
        return callback(err);
      };
    }

    return new Request();

  }
]);

module.exports = traversonAngular;
