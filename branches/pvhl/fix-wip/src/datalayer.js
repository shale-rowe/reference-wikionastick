/*
 *  API for the data layer abstraction
*/

// @module lock
// provides locking facilities by using a file describing locked entries
woas.lock = {
	// hashmap with a lock entry for each active filename
	datasources : {},
	
	_reset : function() {
		// clear object
		this.datasources = {};
		//TODO: add one entry for each expected datasource
	},
	
	_generate_magic_lock : function() {
		return _random_string(10);
	},
	
	_load_locks : function() {
		// locking currently disabled
		return true;
/*		var lck_file = woas.ROOT_DIRECTORY + woas.config.wsif_ds + ".lock";
		// attempt reading the lock file index
		var lock_data = woas.load_file(lck_file);
		// fail in case of no loading API available
		if (lock_data === null)
			return false;
		var need_save = false;
		// the lock file does not exist, it's time to initialize it
		if (lock_data === false) {
			this._reset();
			// we will write the file
			need_save = true;
		} else {
			// check that
		}
		return true;
*/
	},
	
	_update_locks : function() {
		//TODO: write the lock file index
		return true;
	},
	
	is_locked : function(filename) {
		// if lock is not defined, it is not active of course
		if (typeof this.datasources[filename] == "undefined")
			return false;
		return this.datasources[filename].active;
	},
	
	// called when editing some page which modifies one or more datasources
	// returns true if lock could be held successfully
	hold : function(filename, whom) {
		// locking currently disabled
		return true;
/*		// (1) each time there is an attempt to lock/unlock something we read the lock file index
		// and check if the datasource has been locked or if there have been changes to some lock
		if (!this._load_locks())
			return false;
		
		// (2) is this file already locked?
		if (this.is_locked(filename)) {
			var lock = this.datasources[filename];
			if (!confirm("%s was locked by %s at %s.\nDo you want to ignore this lock?\n\nWARNING: PRESS OK ONLY IF NOBODY ELSE IS EDITING".
						sprintf(filename, lock.owner, lock.when.toLocaleString()
						)))
				return false;
			// otherwise ignore lock
			lock = null;
		}
		
		// (3) re-create the lock
		this.datasources[filename] = {
			magic : this._generate_magic_lock(),		// magic is used to compare two locks
			owner : whom,								// author of locking
			when : new Date(),							// when locking happened
			active : true
		};
		
		// update the lock index
		return this._update_locks();
*/
	},
	
	release : function(filename) {
		// locking currently disabled
		return true;
/*		// (1) each time there is an attempt to lock/unlock something we read the lock file index
		// and check if the datasource has been locked or if there have been changes to some lock
		if (!this._load_locks())
			return false;
		// (2) check if datasource is actually locked
		if (typeof this.datasources[filename] == "undefined") {
//			woas.log("BUG: NO LOCK exists for "+filename);	//log:0
			return false;
		}
		// unactive the lock object (but keep it to check if file was modified)
		this.datasources[filename].active = false;
		// update the lock index
		return this._update_locks();
*/
	}
};

/*
PVHL: returns 0 if save failed, -1 if path not specified;
blob save disabled until it works cross-browser; at that time inline_wsif needs
to be passed into this function - was always set for multi-file wsif.
*/
woas._wsif_ds_save = function(subpath, ds_lock, plist) {
	// if we have a native sub-path, trigger the WSIF datasource save
	if (subpath.length === 0)
		return -1; // this will test true (no error)
	// always save in the root directory or a path below it
/**
PVHL: the option page has always stated that a relative path can be entered
for the WSIF data source -- as the argument 'subpath' suggests -- so we can't
just save to rootdirectory. The original code saved the index file to the
subpath, and multiple-WSIF files to the root!
*/
	var fname, pos;
	// convert to unix path for processing
	subpath = subpath.replace(/\\/g, '/');
	pos = subpath.lastIndexOf('/') + 1;
	if (pos) {
		fname = subpath.substring(pos);
		subpath = woas.ROOT_DIRECTORY + subpath.substring(0, pos);
	}  else {
		fname = subpath;
		subpath  = woas.ROOT_DIRECTORY;
	}
	if (is_windows) {
		// convert unix path to windows path
		subpath = subpath.replace(/\//g, '\\');
	}
	return this._native_wsif_save(subpath, fname, this.config.wsif_ds_lock,
							!this.config.wsif_ds_multi,	false,
							this.config.wsif_author, true, plist);
};

//API1.0: save all pages
woas.full_commit = function() {
	var r = this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock);
	// PVHL: don't save html if wsif save failed (added to all commit functions)
	if (!r) this.alert(this.i18n.WSIF_SAVE_FAIL);
	return r ? this._save_to_file(true) : false;
};

//API1.0: save WoaS configuration
// PVHL: There is a very bad bug here: when options page is saved all edits are lost.
//   Also, if cumulative save is set the woas is completely corrupted. Though saved
//   changes exist in file, they don't exist in DOM and so are lost in config only save.
//   I'm not interested in finding & fixing as WoaS should be saving layout from a page.
//   Quick fix is to disable config-only save and save everything every time.
//   Was: return this._save_to_file(false);
woas.cfg_commit = function() {
	if (this.config.wsif_ds.length !== this._old_wsif_ds_len) {
		var r = this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock);
		if (!r) this.alert(this.i18n.WSIF_SAVE_FAIL);
		return r ? this._save_to_file(true) : false;
	}
	return this._save_to_file(true);
};

//API1.0: save specific list of pages
// plist is a list of page indexes which need to be saved
// Currently just saving all the pages.
woas.commit = function(plist) {
	var r = this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock, plist);
	if (!r) this.alert(this.i18n.WSIF_SAVE_FAIL);
	// performs full save, while the single page + global header could be saved instead
	return r ? this._save_to_file(true) : false;
};

//API1.0: delete specific list of pages
// plist is a list of page indexes which need to be saved (not allowed to be empty)
woas.commit_delete = function(plist) {
	// update only the native WSIF index (leaves back deleted pages)
	var r = this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock, []);
	if (!r) this.alert(this.i18n.WSIF_SAVE_FAIL);
	// performs full save, while the single page + global header could be saved instead
	return r ? this._save_to_file(true) : false;
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
		if (p !== -1)
			this.save_queue.splice(p,1);
	}
};

//API1.0: event called when the config was successfully saved
woas.after_config_saved = function() {
	woas.cfg_changed = false;
};
