// this file contains API for the data layer abstraction

// private function used during development for page contents versioning
woas._native_save = function(plist) {
	// if we have a native sub-path, trigger the native WSIF data export
	if (!this.tweak.native_wsif)
		return;
	// always save in the root directory
	var done;
	// code disabled since we always save the full backup
//	if (typeof plist != "undefined" )
//		done = this._native_wsif_save(path,	true, true, "", true, plist); else
	done = this._native_wsif_save(woas.ROOT_DIRECTORY,	true, true, "", true);

	log("saved "+done+" pages natively"); // log:1
};

//API1.0: save all pages
woas.full_commit = function() {
	this._native_save();
	return this._save_to_file(true);
};

//API1.0: save WoaS configuration
woas.cfg_commit = function() {
	return this._save_to_file(false);
};

//API1.0: save specific list of pages
// plist is a list of page indexes which need to be saved
woas.commit = function(plist) {
	this._native_save(plist);
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
};

//API1.0: delete specific list of pages
// plist is a list of page indexes which need to be saved (not allowed to be empty)
woas.commit_delete = function(plist) {
	// update only the native WSIF index (leaves back deleted pages)
	this._native_save([]);
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
};

//API1.0: event called after some page is being saved
// plist can be undefined if all pages were saved
woas.after_pages_saved = function(plist) {
	// we assume that everything was saved
	if (typeof plist == "undefined") {
		this.save_queue = [];
		return;
	}
	// we remove each of the saved pages from queue (needs TESTING!)
	for(var i=0,l=plist.length;i<l;i++) {
		var p = this.save_queue.indexOf(plist[i]);
		if (p != -1)
			this.save_queue = this.save_queue.slice(0,p).concat(this.save_queue.slice(p+1));
	}
};

//API1.0: event called when the config was successfully saved
woas.after_config_saved = function() {
	cfg_changed = false;
};
