
// load modes which should be supported
woas["file_mode"] = {
	UTF8_TEXT: 0,
	DATA_URI: 1,
	BINARY: 2
}

// get filename of currently open file in browser
function _get_this_filename() {
	var filename = unescape(document.location.toString().split("?")[0]);
	if (filename.indexOf("file://") === 0) // all browsers
		filename = filename.substr(7);
	if (filename.indexOf("///")===0) // firefox
		filename = filename.substr(1);
	filename = filename.replace(/#.*$/g, ""); // remove fragment
	if (is_windows) {
		// convert unix path to windows path
		filename = filename.replace(/\//g, "\\");
		if (filename.substr(0,2)!="\\\\") { // if this is not a network path - will be true in case of Firefox for example
			// remove leading slash before unit:
			if (filename.match(/^\\\w:\\/))
				filename = filename.substr(1);
			if (filename.charAt(1)!=':') {
				if (ie)
					filename = "\\\\"+filename;
			}
		}
	}
	return filename;
}

// save the currently open WoaS
function _saveThisFile(new_data, old_data) {
	var filename = _get_this_filename();
	
	r = woas.save_file(filename, woas.file_mode.UTF8_TEXT,
	woas.DOCTYPE + woas.DOC_START +
	"<sc"+"ript type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");	// log:1
	else
		alert("Save to file \""+filename+"\" failed!\n\nMaybe your browser is not supported");
	return r;
}

//API1.0: save-file handler
woas["save_file"] = function(fileUrl, save_mode, content) {
	var r = null;
	r = this.mozillaSaveFile(fileUrl, save_mode, content);
	if((r == null) || (r == false))
		r = this.ieSaveFile(fileUrl, save_mode, content);
	if((r == null) || (r == false))
		r = this.javaSaveFile(fileUrl, save_mode, content);
	return r;
}

// get file content in FF3 without .enablePrivilege() (fbnil)
woas["mozillaLoadFileID"] = function(field_id, load_mode){
	var filename = document.getElementById(field_id).value;
	if(filename == "")
		return false;
	if(!window.Components || !document.getElementById(field_id).files)
		return null;
	var D=document.getElementById(field_id).files.item(0);
	switch (load_mode) {
		case this.file_mode.DATA_URI:
			return D.getAsDataURL();
		break;
		case this.file_mode.BINARY:
			return D.getAsBinary();
		//.getAsText()
//		default:
	}
	// return UTF-8 text by default
	return D.getAsText("utf-8");
}

// *** original source of below functions was from TiddyWiki ***

// API1.0: load-file handler
woas["load_file"] = function(fileUrl, load_mode){
	// parameter consistency check
	if (!load_mode)
		load_mode = this.file_mode.UTF8_TEXT;
	var r = null;
	// try loading the file without using the path (FF3+)
	// (object id hardcoded here)
	r = this.mozillaLoadFileID("filename_", load_mode);
	if (!r) // load file using file absolute path
		r = this.mozillaLoadFile(fileUrl, load_mode);
	// no mozillas here, attempt the IE way
	if(!r)
		r = this.ieLoadFile(fileUrl, load_mode);
	// finally attempt to use Java
	r = this.javaLoadFile(fileUrl, load_mode);
	if(!r)
		this.alert('Could not load "'+fileUrl+'"');
	return r;
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
woas["ieSaveFile"] = function(filePath, save_mode, content) {
	var s_mode;
	if (save_mode == this.file_mode.BINARY)
		s_mode = 0; // ASCII
	else
		s_mode = -1; // Unicode used for DATA_URI and UTF8_TEXT modes
	try	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
		var file = fso.OpenTextFile(filePath, 2, true, s_mode);
		file.Write(content);
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to save: " + e.toString());	// log:1
		return(false);
	}
	return(true);
}

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
woas["ieLoadFile"] = function(filePath, load_mode) {
	var o_mode;
	if (load_mode == this.file_mode.BINARY)
		o_mode = 0; // ASCII
	else
		o_mode = -1; // Unicode used for DATA_URI and UTF8_TEXT modes
	var content = null;
	try {
		var fso = new ActiveXObject("Scripting.FileSystemObject");
		// attempt to open as unicode
		var file = fso.OpenTextFile(filePath,1,false,o_mode);
		var content = file.ReadAll();
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e.toString());	// log:1
		return(null);
	}
	// return a valid DATA:URI
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content);
	// fallback for UTF8_TEXT
	return(content);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
woas["mozillaSaveFile"] = function(filePath, save_mode, content) {
	//FIXME: save_mode is not considered here
	if(window.Components)
		try
		{
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(filePath);
			if (!file.exists())
				file.create(0, 0664);
			else
				log("File \""+filePath+"\" exists, overwriting");	// log:1
			var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			out.init(file, 0x20 | 0x02, 00004,null);
			out.write(content, content.length);
			out.flush();
			out.close();
			return(true);
		}
		catch(e)
		{
			log("Exception while attempting to save\n\n" + e);	// log:1
			return(false);
		}
	return(null);
}

// Returns null if it can't do it, false if there's an error, or a string
// with the content if successful
woas["mozillaLoadFile"] = function(filePath, load_mode) {
	// this is available on Mozilla browsers
	if(window.Components)
		try
		{
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(filePath);
			if (!file.exists())
				return(null);
			var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
			inputStream.init(file, 0x01, 00004, null);
			var sInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
			sInputStream.init(inputStream);
			if (load_mode == this.file_mode.UTF8_TEXT)
				return sInputStream.read(sInputStream.available());
			// this byte-by-byte read allows retrieval of binary files
			var tot=sInputStream.available(), i=tot;
			var rd=[];
			while (i-->=0) {
				var c=sInputStream.read(1);
				rd.push(c.charCodeAt(0));
			}
			if (load_mode == this.file_mode.BINARY)
				return(merge_bytes(rd));
			else if (load_mode == this.file_mode.DATA_URI)
				return this._data_uri_enc(filePath, merge_bytes(rd));
		}
		catch(e)
		{
			log("Exception while attempting to load\n\n" + e);	// log:1
			return(false);
		}
	return(null);
}

// creates a DATA:URI from a plain content stream
woas["_data_uri_enc"] = function(filename, ct) {
	// perform base64 encoding
	ct = encode64(ct);
		
	var m=filename.match(/\.(\w+)$/);
	if (m==null) m = "";
	else m=m[1].toLowerCase();
	var guess_mime = "image";
	switch (m) {
		case "png":
			guess_mime = "image/png";
		break;
		case "gif":
			guess_mime = "image/gif";
			break;
		case "jpg":
		case "jpeg":
			guess_mime = "image/jpeg";
			break;
	}
	return "data:"+guess_mime+";base64,"+ct;
}

function _javaUrlToFilename(url)
{
	var f = "//localhost";
	if(url.indexOf(f) == 0)
		return url.substring(f.length);
	var i = url.indexOf(":");
	if(i > 0)
		return url.substring(i-1);
	return url;
}

woas["javaSaveFile"] = function(filePath,save_mode,content) {
	//FIXME: save_mode is not considered here
	try {
		if(document.applets["TiddlySaver"])
			return document.applets["TiddlySaver"].saveFile(_javaUrlToFilename(filePath),"UTF-8",content);
	} catch(ex) {
	}
	try {
		var s = new java.io.PrintStream(new java.io.FileOutputStream(_javaUrlToFilename(filePath)));
		s.print(content);
		s.close();
	} catch(ex) {
		if(window.opera) {
			opera.postError(e);
			return false;
		}
		return null;
	}
	return true;
}

woas["javaLoadFile"] = function(filePath, load_mode) {
	//FIXME: UTF8_TEXT/BINARY is not separated here!!
	var content = null;
	try {
		if(document.applets["TiddlySaver"]) {
			content = String(document.applets["TiddlySaver"].loadFile(_javaUrlToFilename(filePath),"UTF-8"));
			if (load_mode == this.file_mode.DATA_URI)
				return this._data_uri_enc(filePath, content);
			return content;
		}
	} catch(ex) {
		log("TiddlySaver not working: "+e)
	}
	var a_content = [];
	try {
		var r = new java.io.BufferedReader(new java.io.FileReader(_javaUrlToFilename(filePath)));
		var line;
		while((line = r.readLine()) != null)
			a_content.push(new String(line));
		r.close();
	} catch(ex) {
//		if(window.opera)
//			opera.postError(e);
		log("Exception in javaLoadFile(\""+filePath+"\"): "+e)
		return false;
	}
	// re-normalize input
	content = a_content.join("\n");
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content);
	return content;
}
