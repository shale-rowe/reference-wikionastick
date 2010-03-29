
var reMacroDef = /^(%?[A-Za-z0-9_]+):([\s\S]*)$/;
// macro syntax plugin code adapted from FBNil's implementation
woas["macro_parser"] = function(text){
	var macro = { "reprocess": false, "text": text };
	var M=text.match(reMacroDef);
	// if no double colon declaration was found, then do not process anything
	if (M !== null) {
		var fn = M[1];
		// check that this is not a macro definition request
		if (fn.charAt(0) == '%') {
			fn = fn.substr(1);
			// when macro is not defined, define it
			if (this.macro_parser.create(fn, M[2])) {
				// we totally remove the block
				macro.reprocess = true;
				macro.text = "";
	//			macro.text = "<!-- defined "+fn+" macro -->";
			}
			return macro;
		}
		var fi = this.macro_parser.macro_names.indexOf(fn);
		if (fi != -1) {
			macro.text = M[2];
			this.macro_parser.macro_functions[fi](macro);
		} else {
			log("Undefined macro "+fn);
		}
	}
	return macro;
}

// this is the function to be called to register a  macro
// each macro function must accept a macro object as parameter and modify
// such object (it is always passed by reference)
woas["macro_parser"]["register"] = function(fn_name, fn_object) {
	if (woas.macro_parser.macro_names.indexOf(fn_name) != -1) {
		log("cannot redefine macro "+fn_name); //log:1
		return false;
	}
	woas.macro_parser.macro_names.push(fn_name);
	woas.macro_parser.macro_functions.push(fn_object);
	return true;
}

// some default macros
woas["macro_parser"]["default_macros"] = {
	// advanced transclusion: each newline creates a parameter
	"include":function(m) {
		var params = m.text.split("\n");
		// embedded transclusion not supported
		if (!params.length || !woas.page_exists(params[0]) || woas.is_embedded(params[0]))
			return m;
		var nt = woas.get_text_special(params[0]);
		if (nt === null)
			return m;
		if (params.length) { // replace transclusion parameters
			nt = nt.replace(/%\d+/g, function(str) {
				var paramno = parseInt(str.substr(1));
				if (paramno < params.length)
					return params[paramno];
				else
					return str;
				} );
		}
		m.text = nt;
		m.reprocess = true;
		return m;
}
};

woas["macro_parser"]["macro_names"] = ["include"];
woas["macro_parser"]["macro_functions"] = [woas.macro_parser.default_macros.include];

woas["macro_parser"].create = function(fn_name, fn_code) {
	// duplicated from register function
	if (woas.macro_parser.macro_names.indexOf(fn_name) != -1) {
		log("cannot redefine macro "+fn_name); //log:1
		return false;
	}
	var obj = null;
	try {
		eval("obj = function "+fn_name+"(macro) {\n"+fn_code+"\n}");
	}
	catch (e) {
		log("cannot define function "+fn_name+": "+e); //log:1
	}
	return this.register(fn_name, obj);
}
