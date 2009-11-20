#!/usr/bin/perl


my $woas = shift || 'woas.htm';
crash(-1, "Consumed with anger because woas hml file '$woas' does not exist!") if (! -f $woas);
my $ct = slurp($woas);

crash(-2, "Could not find marker\n") unless ($ct =~ /\nvar __marker = "([^"]+)";/ );
my $marker = $1;

$p = index($ct, '/* '.$marker.'-END */', 0);
$ep = index($ct, '</head>', $p);

my $tail = substr($ct, $p, $ep-$p);

$base_dir = dirname($woas).'/';

my $replaced = 0;

$tail =~ s`<script src="([^"]+)" type="text/javascript"></script>`&script_replace($1)`gems;

crash(-3, "Could not find any script tag to replace\n".$tail) unless($replaced);

substr($ct, $p, $ep-$p, $tail);

file_put_contents('woas-merged.htm', $ct);

print "WoaS merged into single file woas-merged.htm " . length($ct) .  " bytes\n";

exit 0;

sub slurp {
	my ($filename, $default)=@_;
	return 0 unless( $filename && -f $filename);
	open(PLATE, $filename) or crash(2, "Error opening '$filename'");
	my $slash = $/;
	undef $/;
	$spaguetti = <PLATE>;
	$/ = $slash;
	return $spaguetti;
}

sub crash{
	my($errorcode, $errormessage) = @_;
	$! = $errorcode;
	@C = caller();
	die "@C: " . $errormessage . "\n";
}

sub dirname{
	$_ = shift;
	s`\\`/`g;
	return $_ if(s`/[^/]*``);
	return '.';
}

sub basename{
	$_ = shift;
	s`\\`/`g;
	return $_ if(s`^.*/``);
	return '.';
}

sub script_replace {
	my($t) = @_;
	my $jsm = "$base_dir/$t";
	crash($replaced, "Could not locate '$jsm'") unless(-f $jsm);
	my $ct = slurp($jsm);
	# remove BOM if present
	my $BOM = sprintf ("\\x%X\\x%X\\x%X/A", 239, 187, 191);
	$ct =~ s/$BOM//;

	#$ct=~s/\n\n//gm;
	#$ct=~s/^\s*//gs;
	++$replaced;
	return '<script language="javascript" type="text/javascript">'
	."\n/* <![CDATA[ */\n/*** ".basename($jsm)." ***/\n".$ct
	."\n/* ]]> */ </script>";
}

sub file_put_contents {
	my($destination, $content) = @_;
	open(FPC, '>', $destination) or crash("Unable to save to '$destination', $!");
	print FPC $content;
	close(FPC);
}