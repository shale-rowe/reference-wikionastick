
woas["export_wiki_wsif"] = function () {
	// export settings object
	var wsif_exp = {};
	try {
		wsif_exp["path"] = $("woas_ep_wsif").value;
		wsif_exp["author"] = this.trim($("woas_ep_author").value);
		wsif_exp["unix_norm"] = $("woas_cb_unix_norm").checked ? true : false;
		wsif_exp["single"] = $("woas_cb_single_wsif").checked ? true : false;
	} catch (e) { this.crash(e); return false; }
	
	//TODO: WSIF export code
}
	
