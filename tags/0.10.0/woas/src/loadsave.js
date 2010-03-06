
// force binary file write - this is a hack for some testing
var _force_binary = false;

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
	
	r = saveFile(filename,
	woas.DOCTYPE + woas.DOC_START +
	"<sc"+"ript type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");	// log:1
	else
		alert("Save to file \""+filename+"\" failed!\n\nMaybe your browser is not supported");
	return r;
}

// save-file handler
function saveFile(fileUrl, content)
{
	var r = null;
	r = mozillaSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = ieSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = javaSaveFile(fileUrl, content);
	return r;
}

// get file content in FF3 without .enablePrivilege() (fbnil)
function mozillaLoadFileID(field_id){
	var filename = document.getElementById(field_id).value;
	if(filename == "")
		return false;
	if(!window.Components || !document.getElementById(field_id).files)
		return null;
	var D=document.getElementById(field_id).files.item(0);
	if (_force_binary) {
		_got_data_uri = true;
		return D.getAsDataURL(); // .getAsBinary() .getAsText()
	}
//	if(asType==1)
	return D.getAsText("utf-8");
}

// *** original source of below functions was from TiddyWiki ***

// load-file handler
function loadFile(fileUrl){
	var r = null;
	// try loading the file without using the path (FF3+)
	// (object id hardcoded here)
	r=mozillaLoadFileID("filename_", 1);
	if (!r) // load file using file absolute path
		r = mozillaLoadFile(fileUrl);
	// no mozillas here, attempt the IE way
	if(!r)
		r = ieLoadFile(fileUrl);
	if(!r)
		alert('Could not load "'+fileUrl+'"');
	//L: seems like this is not yet implemented
	//r = operaLoadFile(fileUrl); // TODO
	return r;
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
function ieSaveFile(filePath, content)
{
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch(e) {
		log("Exception while attempting to save: " + e.toString());	// log:1
		return(false);
	}
/*	if (_force_binary) {
		alert("Binary write with Internet Explorer is not supported");
		return false;
	}	*/
	var mode = _force_binary ? -1:0;
	var file = fso.OpenTextFile(filePath,2,-1, mode);
	file.Write(content);
	file.Close();
	return(true);
}

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
function ieLoadFile(filePath)
{
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
		var file = fso.OpenTextFile(filePath,1);
		var content = file.ReadAll();
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e.toString());	// log:1
		return(null);
	}
	return(content);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
function mozillaSaveFile(filePath, content)
{
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

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
function mozillaLoadFile(filePath)
{
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
			if (!_force_binary)
				return sInputStream.read(sInputStream.available());
			// this byte-by-byte read allows retrieval of binary files
			var tot=sInputStream.available(), i=tot;
			var rd=[];
			while (i-->=0) {
				var c=sInputStream.read(1);
				rd.push(c.charCodeAt(0));
			}
			return(merge_bytes(rd));
		}
		catch(e)
		{
			log("Exception while attempting to load\n\n" + e);	// log:1
			return(false);
		}
	return(null);
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

function javaSaveFile(filePath,content)
{
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

function javaLoadFile(filePath)
{
	try {
		if(document.applets["TiddlySaver"])
			return String(document.applets["TiddlySaver"].loadFile(_javaUrlToFilename(filePath),"UTF-8"));
	} catch(ex) {
	}
	var content = [];
	try {
		var r = new java.io.BufferedReader(new java.io.FileReader(_javaUrlToFilename(filePath)));
		var line;
		while((line = r.readLine()) != null)
			content.push(new String(line));
		r.close();
	} catch(ex) {
		if(window.opera)
			opera.postError(e);
		log("Exception in javaLoadFile(\""+filePath+"\"): "+e)
		return null;
	}
	return content.join("\n");
}