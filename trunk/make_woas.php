<?php
## WoaS compiler
# @author legolas558
# @copyright GNU/GPL license
# 
# run 'php -q make_woas.php' to create a single-file version from the multiple files version
# additional understood pameters are:
# 
# woas=woas/path		path to WoaS HTML file - defaults to woas.htm
# log=[0|1|2]		0 - fully disable log, 1 - keep logging as is, 2 - enable all log lines
# debug=[0|1]		specify 1 to enable debugging code
# edit_override=[0|1]	specify 1 to enable the edit override

$woas = null;
$log = $debug = $edit_override = false;

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
				echo $v." is not a valid file\n";
				continue 2;
			}
			$woas = $v;
			break;
		case 'log':
			$log = $v?1:0;
			break;
		case 'debug':
			$debug = $v?1:0;
			break;
		case 'edit_override':
			$edit_override = $v?1:0;
			break;
		default:
		echo "Parameter ".$a[0]." is not recognized\n";
	}
}

if (!isset($woas))
	$woas = 'woas.htm';

if (!file_exists($woas)) {
	echo "File $woas does not exist\n";
	exit(-1);
}

$ct = file_get_contents($woas);

if (!preg_match('/\\nvar __marker = "([^"]+)";/', $ct, $m)) {
	echo "Could not find marker\n";
	exit(-2);
}

$marker = $m[1];

$p=strpos($ct, '/* '.$marker.'-END */');
$ep = strpos($ct, '</head>', $p);

$tail = substr($ct, $p, $ep-$p);

global $replaced, $base_dir;
$replaced=0;
$base_dir = dirname($woas).'/';
function _script_replace($m) {
	global $replaced, $base_dir;
	if (!file_exists($base_dir.$m[1])) {
		echo "Could not locate $base_dir".$m[1]."\n";
		return $m[0];
	}
	$ct = file_get_contents($base_dir.$m[1]);
	//TODO: apply modifications now
	++$replaced;
	echo "Replaced ".$m[1]."\n";
	return '<script language="javascript" type="text/javascript">'.
		"\n/* <![CDATA[ */\n/*** ".basename($m[1])." ***/\n".$ct.
		"\n/* ]]> */ </script>\n";
}

$tail = preg_replace_callback('/<script src=\"([^"]+)" type="text\\/javascript"><\\/script>/', '_script_replace', $tail);

if (!$replaced) {
	echo "Could not find any script tag to replace\n";
	exit(-3);
}

$ct = substr_replace($ct, $tail, $p, $ep-$p);

file_put_contents('woas-merged.htm', $ct);

echo "WoaS merged into single file\n";

exit(0);

?>