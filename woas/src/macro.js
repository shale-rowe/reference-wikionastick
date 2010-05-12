
// macro syntax plugin code adapted from FBNil's implementation
woas["macro_parser"] = function(text){
	var macro = { "reprocess": false, "text": text };
	var M=text.match(/^(%?[A-Za-z0-9_]+):\n([\s\S]*)$/);
	// if no double colon declaration was found, then do not process anything
	if (M !== null) {
		var U = this.macro_parser.macros;
		var fn = M[1];
		// check that this is not a macro definition request
		if (fn.charAt(0) == '%') {
			fn = fn.substr(1);
			// when macro is not defined, define it
			if (!this.macro_parser.create(fn, M[2]))
				return macro;
			// we totally remove the block
			macro.reprocess = true;
			macro.text = "";
//			macro.text = "<!-- defined "+fn+" macro -->";
			return macro;
		}
		switch(typeof(U[M[1]])){
			case 'function':
				macro.text = M[2];
				U[fn](macro);
			break;
			case 'undefined':
				log("Undefined macro "+fn);
			break;
//			default:
		}
	}
	return macro;
}

woas["macro_parser"]["macros"] = {};

// this is the function to be called to register a  macro
// each macro function must accept a macro object as parameter and modify
// such object (it is always passed by reference)
woas["macro_parser"]["register"] = function(fn_name, fn_object) {
	if (typeof woas.macro_parser.macros[fn_name] != "undefined")
		return false;
	woas.macro_parser.macros[fn_name] = fn_object;
	return true;
}

/*
woas["macro_parser"].pre = function(m){return "<pre>"+woas.xhtml_encode(m)+"</pre>"}
woas["macro_parser"].nobr = function(m){return m.replace(/\n/g,"")}
woas["macro_parser"].verbatim = function(m){return m} // protect block 
woas["macro_parser"].parse = function(m){return woas.parser.parse(m) } // protect parsed block (allows lists in tables!)
woas["macro_parser"].js = function(m){this.post++;return this._default(m)}
*/
woas["macro_parser"]._default = function(text){
	var _print="";
	function print(t){_print+=t;}
	try{
		eval(text);
		return _print;
	}catch(e){
		alert("macro_parser JS:"+e+"\n"+text)
	}
	return "";
}

woas["macro_parser"].create = function(fn_name, fn_code) {
	var obj = null;
	try {
		eval("obj = function "+fn_name+"(macro) {\n"+fn_code+"\n}");
	}
	catch (e) {
		log("cannot define function "+fn_name+": "+e); //log:1
	}
	return this.register(fn_name, obj);
}
