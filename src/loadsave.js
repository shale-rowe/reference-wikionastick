
function _get_this_filename() {
	var filename = unescape(document.location.toString().split("?")[0]);
	filename = filename.replace(/^file:\/\/\//, '').replace(/#.*$/g, "");
//	if (ie && (filename.search(/^file:\/\//)===0))
//		filename = "//?/"+filename.substr(7);
	if (navigator.appVersion.indexOf("Win")!=-1)
		filename = filename.replace(/\//g, "\\");
	else
		filename = "/" + filename;
	return filename;
}

function _saveThisFile(new_data, old_data)
{
	var filename = _get_this_filename();
	r = saveFile(filename,
	_doctype+"<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<head>\n<sc"+"ript type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");
	else
		alert("Save to file \""+filename+"\" failed!\n\nMaybe your browser is not supported");
	return r;
}

// Copied from TiddyWiki
function saveFile(fileUrl, content)
{
	var r = null;
	r = mozillaSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = ieSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = operaSaveFile(fileUrl, content);
	return(r);
}

function loadFile(filePath)
{
	var r = null;
	r = mozillaLoadFile(filePath);
	if((r == null) || (r == false))
		r = ieLoadFile(filePath);
	if((r == null) || (r == false))
		r = operaLoadFile(filePath);
	return(r);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
function ieSaveFile(filePath, content)
{
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch(e)
	{
		log("Exception while attempting to save\n\n" + e.toString());
		return(false);
	}
	if (!_force_binary) {
		var file = fso.OpenTextFile(filePath,2,-1,0);
		file.Write(content);
		file.Close();
	} else {
		alert("Binary write with Internet Explorer is not supported");
		return false;
	}
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
	catch(e)
	{
		alert("Exception while attempting to load\n\n" + e.toString());
		return(null);
	}
	return(content);
}

var _force_binary = false;

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
			alert("Exception while attempting to load\n\n" + e);
			return(false);
		}
	return(null);
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
				log("File exists, overwriting");
			var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			out.init(file, 0x20 | 0x02, 00004,null);
			out.write(content, content.length);
			out.flush();
			out.close();
			return(true);
		}
		catch(e)
		{
			alert("Exception while attempting to save\n\n" + e);
			return(false);
		}
	return(null);
}

function operaUrlToFilename(url)
{
	var f = "//localhost";
	if(url.indexOf(f) == 0)
		return url.substring(f.length);
	var i = url.indexOf(":");
	if(i > 0)
		return url.substring(i-1);
	return url;
}

function operaLoadFile(filePath)
{
	var content = [];
	try
	{
		var r = new java.io.BufferedReader(new java.io.FileReader(operaUrlToFilename(filePath)));
		var line;
		while ((line = r.readLine()) != null)
			content.push(new String(line));
		r.close();
	}
	catch(e)
	{
		if(window.opera)
			opera.postError(e);
		return null;
	}
	return content.join("\n");
}

function operaSaveFile(filePath, content)
{
	try
	{
		var s = new java.io.PrintStream(new java.io.FileOutputStream(operaUrlToFilename(filePath)));
		s.print(content);
		s.close();
	}
	catch(e)
	{
		if(window.opera) {
			opera.postError(e);
			return false;
		}
		return null;
	}
	return true;
}
