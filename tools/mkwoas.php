#!/usr/bin/php -q
<?php
## WoaS compiler
# @author legolas558
# @copyright GNU/GPL license
# @version 1.4.1
# 
# run 'mkwoas.php woas.htm' to create a single-file version
# from the multiple files version
# additional understood pameters are:
# 
# woas=path/woas.htm		path to WoaS HTML file - defaults to woas.htm
# wsif=path/index.wsif		path to pages data in WSIF format
# edit_override=[0|1]		specify 1 to enable the edit override
#

/*** START OF FUNCTIONS BLOCK ***/
global $ALL_SCRIPTS;
$ALL_SCRIPTS = "";
function _script_replace($m) {
	$orig = $m[0];
	if (!preg_match_all('/src="([^"]+)"/', $m[0], $m)) {
		fprintf(STDERR, "Could not find script sources\n");
		return $orig;
	}
	$m = $m[1];
	global $replaced, $base_dir, $ALL_SCRIPTS;
	foreach($m as $scriptname) {
		if (!file_exists($base_dir.$scriptname)) {
			fprintf(STDERR, "Could not locate $base_dir".$scriptname."\n");
			return $orig;
		}
		$ct = file_get_contents($base_dir.$scriptname);
		// remove BOM if present
		$ct = preg_replace('/\\x'.dechex(239).'\\x'.dechex(187).'\\x'.dechex(191).'/A', '', $ct);

		// put the SVN revision here
		if ($scriptname === "src/stickwiki.js") {
			// attempt to grab SVN revision
			if (preg_match("/revision=\"(\\d+)\"/", shell_exec("svn --xml info ."), $rev))
				$rev = (int)$rev[1];
			else $rev = null;
			$ct = str_replace("-r@@WOAS_REVISION@@", ($rev === null) ? "" : "-r".$rev, $ct);
		} else if ($scriptname === "src/ui.js") { // a necessary hotfix for JS packing
			function _fix_newlines($m) {
				return str_replace("\\n\\\n", "\\n", $m[0]);
			}
			$ct = preg_replace_callback('/cPopupCode:\\s*"[^"]+"/s', '_fix_newlines', $ct);
		} else if ($scriptname === "src/core.js") {
			// apply the custom settings
			$ct = preg_replace_callback("/woas\\.tweak\\s*=\\s*\\{([^;]+)/s", '_replace_tweak_vars', $ct);
		}

		// check if this javascript contains any tag-similar syntax
		// this will kill inline javascript for Opera, so we need to properly conceal those sequences
		if (preg_match_all('!</?([A-Za-z]+)([^>]+)>!s', $ct, $m)) {
			$tags = "";
			reset($m[2]);
			foreach($m[1] as $tag) {
				$attrs = current($m[2]);
				if (substr($attrs, 0, 1) != ';') {
					$tags .= $tag.", ";
				}
				next($m[2]);
			}
			if (strlen($tags))
				fprintf(STDERR, "%s: WARNING! found tag \"%s\"\n", $scriptname, $tags);
		}
		++$replaced;
		echo "Replaced ".$scriptname."\n";
		$ALL_SCRIPTS .= "/*** ".$scriptname." ***/\n".$ct."\n"; $ct = null;
	}
	return '@@WOAS_SCRIPT@@';
}

function _replace_tweak_vars($m) {
	return "woas.tweak = {".
		preg_replace_callback('/([^\\s]+)\\s*:\\s*(true|false)/', '_replace_tweak_vars_single', $m[1]);
}

function _replace_tweak_vars_single($m) {
	$the_var = $m[1];
	$v = null;
	switch ($the_var) {
		case 'edit_override':
			$v = $GLOBALS['edit_override'];
		break;
		case 'integrity_test':
			// always disable the integrity test
			$v = false;
	}
	return $the_var.': '.($v ? 'true' : 'false');
}

function _print_n($n, &$s) {
	if ($n>=1000)
		$s.="0x".dechex($n);
	else
		$s.=sprintf("%d", $n);
	$s .= ",";
}

function _js_encode(&$WSIF, $s, $split_lines = false) {
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if ($split_lines)
		$nl = "\\n\\\n";
	else
		$nl = "\\n";
	$s = str_replace(array("<", ">", "\r\n", "\n", "'"), array("\\x3C", "\\x3E", $nl, $nl, "\\'"),
			str_replace("\\", "\\\\", $s));
	return $WSIF->utf8_js($s);
}

function _print_mixed(&$WSIF, &$page, $attrs, &$pages) {
	// embedded page e.g. byte array
	if ($attrs & 2) {
		$s="[";
		$l=count($e);
		for($i=0;$i<$l-1;++$i) {
			_print_n($e[$i], $s);
		}
		// print the last element
		if ($l>1) {
			if ($n>=1000)
				$s.="0x".dechex($e[$l-1]);
			else
				$s.=sprintf("%d", $e[$l-1]);
		}
		$s.="]";
		// save encoded page
	} else
		$s = "'"._js_encode($WSIF, $page, true)."'";
	
	$pages .= $s.",\n";
}

function _WSIF_get_page(&$WSIF, $title, &$page, $attrs, $mts) {
	global $pages, $page_titles, $page_attrs, $page_mts;
	// store attributes
	_print_n($attrs, $page_attrs);
	// store timestamp
	_print_n($mts, $page_mts);
	// store title
	$page_titles .= "'"._js_encode($WSIF, $title)."',\n";
	// apply special replacements
	if ($title === "Special::About") {
		global $woas_ver;
		$page = str_replace("@@WOAS_VERSION@@", $woas_ver, $page);
	}
	// store page data
	_print_mixed($WSIF, $page, $attrs, $pages);
	// all OK
	return 0;
}

function _inline_vars_rep($m) {
	$var = $m[1];
	if (!isset($GLOBALS[$var]))
		return $m[0];
	$addnl = '';
	switch($var) {
		case 'page_mts':
		case 'page_attrs':
			$ofs = -1;
		break;
		case 'page_titles':
			$addnl = "\n";
			// fallback wanted
		default:
			$ofs = -2;
	}
	$r = "\nvar ".$var." = [".$m[2].substr($GLOBALS[$var], 0, $ofs).$addnl."];";
	unset($GLOBALS[$var]);
	return $r;
}

function _woas_config_cb_single($m) {
	switch ($m[1]) {
		case "wsif_ds":
			$v = "''";
		break;
		case 'wsif_ds_lock':
			$v = 'false';
		break;
		case "store_mts":
		case "wsif_ds_multi":
			$v = 'true';
		default:
			$v = $m[2];
	}
	return '"'.$m[1].'":'.$v;
}

function _woas_config_cb($m) {
	return "woas[\"config\"] = {\n".
		preg_replace_callback('/"([^"]+)"\\s*:\\s*([^,}]+)/', '_woas_config_cb_single', $m[1]).
		"\n};\n";
}

/*** END OF FUNCTIONS BLOCK ***/

// global variables initialization
$woas = $wsif = null;
$edit_override = false;

// parse the command line parameters
for($i=1;$i<$argc;++$i) {
	$a=explode('=', $argv[$i],2);
	if (count($a)!=2 || !strlen($a[1])) {
		echo "Invalid parameter: ".$argv[$i]."\n";
		continue;
	}
	$v=$a[1];
	switch ($a[0]) {
		case 'woas':
			if (!is_file($v)) {
				fprintf(STDERR,"%s is not a valid file\n", $v);
				continue 2;
			}
			$woas = $v;
			break;
		case 'wsif':
			if (!is_file($v)) {
				fprintf(STDERR,"%s is not a valid file\n", $v);
				continue 2;
			}
			$wsif = $v;
			break;
		case 'edit_override':
			$edit_override = $v?1:0;
			break;
		default:
			fprintf(STDERR, "Parameter \"%s\" is not recognized\n", $a[0]);
	}
}

// default path
if (!isset($woas))
	$woas = 'woas.htm';
if (!isset($wsif))
	$wsif = 'index.wsif';

$ct = file_get_contents($woas);

if (!preg_match('/\\nvar __marker = "([^"]+)";/', $ct, $m)) {
	fprintf(STDERR, "Could not find marker\n");
	exit(-2);
}

// properly set default configuration variables
$ct = preg_replace_callback("/woas\\[\"config\"\\]\\s*=\\s*\\{\\s*([^}]+)\\}/s", '_woas_config_cb', $ct);


// get the version string
global $woas_ver;
if (!preg_match("/^var\\s+woas\\s*=\\s*\\{\\s*\"version\"\\s*:\\s*\"([^\"]+)\"\\s*\\}/m", $ct, $woas_ver)) {
	fprintf(STDERR, "ERROR: cannot find WoaS version\n");
	exit(-4);
}
$woas_ver = $woas_ver[1];

$marker = $m[1];
// locate marker end
$p=strpos($ct, '/* '.$marker.'-END */');
$ep = strpos($ct, '</head>', $p);

$tail = substr($ct, $p, $ep-$p);

global $replaced, $base_dir;
$replaced=0;
$base_dir = dirname($woas).'/';

$tail = preg_replace_callback('/(<script woas_permanent=\"1\" src=\"[^"]+" type="text\\/javascript"><\\/script>\\s*)+/s', '_script_replace', $tail);

if (!$replaced) {
	fprintf(STDERR, "ERROR: cannot find any external script to replace\n");
	exit(-3);
}

// apply the custom settings
$tail = preg_replace_callback("/woas\\.tweak\\s*=\\s*\\{([^;]+);/s", '_replace_tweak_vars', $tail);

$ct = substr_replace($ct, $tail, $p, $ep-$p);

// replace the WoaS version string
$ct = str_replace("@@WOAS_VERSION@@", $woas_ver, $ct);

// get the native pages data and convert them to javascript array data
require dirname(__FILE__).'/libwsif.php';

global $pages, $page_title,$page_attrs, $page_mts;
$pages = $page_attrs = $page_titles = $page_mts = "";

$WSIF = new WSIF();
if (false === $WSIF->Load($wsif, '_WSIF_get_page'))
	exit(-19);

// put the data in the woas.htm file
$ct = preg_replace_callback("/\nvar (page[^ ]+) = \\[(.*?)\\];/s", '_inline_vars_rep', $ct);
unset($WSIF);

function _mk_woas($ct, $scripts) {
	return str_replace('@@WOAS_SCRIPT@@',
		// return the script block
		'<script woas_permanent="1" language="javascript" type="text/javascript">'.
		"\n/* <![CDATA[ */\n".$scripts."\n/* ]]> */ </script>"
		, $ct);
}

// the normal WoaS
$ofile = 'woas-'.$woas_ver.'.html';
if (file_put_contents($ofile, _mk_woas($ct, $ALL_SCRIPTS)))
	fprintf(STDOUT, "WoaS v%s merged into %s\n", $woas_ver, $ofile);
else
	exit(-1);

// create minified version (the old way, since proc_open() doesn't work)
// http://www.crockford.com/javascript/jsmin.html
file_put_contents('/tmp/woas.js', $ALL_SCRIPTS);
$MIN_SCRIPTS = shell_exec('jsmin < /tmp/woas.js');
unlink('/tmp/woas.js');
// do not create it in case of failure
if (strlen($MIN_SCRIPTS)) {
	$ofile_min = 'woas-'.$woas_ver.'.min.html';
	if (file_put_contents($ofile_min, _mk_woas($ct, $MIN_SCRIPTS)))
		fprintf(STDOUT, "Created compressed WoaS: %s\n", $ofile_min);
} unset($MIN_SCRIPTS);

$BPATH = dirname(__FILE__).'/';
// create compressed version only if JSCompressor is available
// http://joliclic.free.fr/php/javascript-packer/en/
if (file_exists($BPATH.'class.JavaScriptPacker.php')) {
	require_once $BPATH.'class.JavaScriptPacker.php';

	$packer = new JavaScriptPacker($ALL_SCRIPTS, 10, true);

	$ofile_comp = 'woas-'.$woas_ver.'.comp.html';
	if (file_put_contents($ofile_comp, _mk_woas($ct, $packer->pack())))
		fprintf(STDOUT, "Created compressed WoaS: %s\n", $ofile_comp);
	unset($packer);
}
unset($ALL_SCRIPTS);

exit(0);

?>
