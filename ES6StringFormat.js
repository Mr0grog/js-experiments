/**
 * An experimental (and propably very inefficient) implementation of
 * the string formatting proposal from ECMAScript 6.
 * Proposal: http://wiki.ecmascript.org/doku.php?id=strawman:string_format_take_two
 * 
 * It's not quite complete; some number formatting isn't yet there:
 *   - The '#' flag isn't supported
 *   - e/E format specifier isn't supported
 *   - g/G format specifier isn't supported
 *   - Capitalization is incorrect with f/F
 * 
 * (c) 2012 Rob Brackett (rob@robbrackett.com)
 * This code is free to use under the terms of the accompanying LICENSE.txt file
 */

String.prototype.format = function (data) {
	var args = arguments;
	
	// regex for separating the various parts of an identifier from each other
	var identifierIdentifier = /^(?:\[([^\.\[\]]+)\]|\.?([^\.\[\]]+))(.*)$/
	// convert an identifier into the actual value that will be substituted
	var findByPath = function (path, data, top) {
		var identifiers = path.match(identifierIdentifier);
		if (!identifiers) {
			throw "Invalid identifier: " + path;
		}
		var key = identifiers[1] || identifiers[2];
		// For the first identifier, named keys are a shortcut to "0.key"
		if (top && !isFinite(key)) {
			data = data[0];
		}
		value = data[key];
		// recurse as necessary
		return identifiers[3] ? findByPath(identifiers[3], value) : value;
	};
	
	// replace expression matches things inside {thisIsAToken:withSpecifier} brackets and "{{" and "}}"
	return this.replace(/(?:(^|[^{])\{([^{].*?)\}(?!\}))|(\{\{|\}\})/g, function (match, before, token, doubleBrackets) {
		// if we found double brackets, they're just an escape sequence for single brackets
		if (doubleBrackets) {
			return doubleBrackets[0];
		}
		// separate the identifier (index 0) and the format specifier (index 1)
		var parts = token.split(":");
		var value = findByPath(parts[0], args, true);
		var specifier = parts[1];
		// if a specifier is an identifier itself, do the replacement
		if (specifier && specifier[0] === "{" && specifier.slice(-1) === "}") {
			specifier = findByPath(specifier.slice(1, -1), args, true);
		}
		
		// format the value
		var result = "";
		if (value) {
			result = value.toFormat ? value.toFormat(specifier) : value.toString();
		}
		
		return before + result;
	});
};

Number.prototype.toFormat = function (specifier) {
	var value = this;
	if (!specifier) {
		return value.toString();
	}
	var formatters = specifier.match(/^([\+\-#0]*)(\d*)(?:\.(\d+))?(.*)$/);
	var flags     = formatters[1],
	    width     = formatters[2],
	    precision = formatters[3],
	    type      = formatters[4];
	
	var repeatCharacter = function (character, times) {
		var result = "";
		while (times--) {
			result += character;
		}
		return result;
	}
	
	var applyPrecision = function (result) {
		if (precision) {
			var afterDecimal = result.split(".")[1];
			var extraPrecision = precision - afterDecimal;
			if (isNaN(extraPrecision)) {
				extraPrecision = precision;
			}
			if (extraPrecision > 0) {
				if (result.indexOf(".") === -1) {
					result += ".";
				}
				for (; extraPrecision > 0; extraPrecision--) {
					result += "0";
				}
			}
		}
		return result;
	}
	
	var result = "";
	switch (type) {
		case "d":
			result = Math.round(value - 0.5).toString(10);
			result = applyPrecision(result);
			break;
		case "x":
			result = Math.round(value - 0.5).toString(16);
			break;
		case "X":
			result = Math.round(value - 0.5).toString(16).toUpperCase();
			break;
		case "b":
			result = Math.round(value - 0.5).toString(2);
			break;
		case "o":
			result = Math.round(value - 0.5).toString(8);
			break;
		// TODO: e,E,g,G types
		// not quite clear on whether g/G ignores the precision specifier
		case "f":
		case "F":
			// TODO: proper case for NaN, Infinity
			// proposal talks about INF and INFINITY, but not sure when each would be used :\
		default:
			result = value.toString(10);
			result = applyPrecision(result);
	}
	
	if (~flags.indexOf("+")) {
		if (value >= 0) {
			result = "+" + result;
		}
	}
	
	if (width && result.length < width) {
		// "-" flag is right-fill
		if (~flags.indexOf("-")) {
			result += repeatCharacter(" ", width - result.length);
		}
		else {
			var padding = repeatCharacter(~flags.indexOf("0") ? "0" : " ", width - result.length);
			if (~flags.indexOf("0") && (result[0] === "+" || result[0] === "-")) {
				result = result[0] + padding + result.slice(1);
			}
			else {
				result = padding + result;
			}
		}
	}
	// TODO: # flag
	return result;
};
