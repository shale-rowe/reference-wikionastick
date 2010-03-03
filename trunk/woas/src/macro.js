
// macro syntax plugin code adapted from FBNil's implementation
woas["macro_parser"] = function(text){
	var macro = { "reprocess": false, "text": text };
	var M=text.match(/^([^:]+)(?:|:([\s\S]*))$/);
	// if no double colon declaration was found, then do not process anything
	if (M !== null) {
		macro.text = M[2];
		var U = this.macro_parser.macros;
		switch(typeof(U[M[1]])){
			case 'function':
				U[M[1]](macro);
			case 'undefined':
				log("Unknown macro "+U[M[1]]);	//log:1
			break;
//			default:
		}
	}
	return macro;
}

woas["macro_parser"]["macros"] = [];

// this is the function to be called to register a  macro
// each macro function must accept a macro object as parameter and modify
// such object (it is always passed by reference)
woas["macro_parser"]["register_macro"] = function(fn) {
	woas.macro_parser.macros.push(fn);
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

