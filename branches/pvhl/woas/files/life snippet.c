void LifeFrame::OnSamples(wxCommandEvent& WXUNUSED(event))
{
    // stop if it was running
    OnStop();

    // dialog box
    LifeSamplesDialog dialog(this);

    if (dialog.ShowModal() == wxID_OK)
    {
        const LifePattern pattern = dialog.GetPattern();

        // put the pattern
        m_life->Clear();
        m_life->SetPattern(pattern);

        // recenter canvas
        m_canvas->Recenter(0, 0);
        m_tics = 0;
        UpdateInfoText();
    }
}
