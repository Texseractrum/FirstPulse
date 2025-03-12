"use client";
import React, { useState, useEffect, useCallback } from "react";

// Sample training scenario data with detailed prompts for each scenario
const trainingScenarios = [
  {
    id: 1,
    name: "John Smith",
    description: "Elderly patient with chest pain and difficulty breathing.",
    results:
      "Patient required immediate oxygen therapy and cardiac monitoring.",
    status: "to be completed",
    systemPrompt: `John Smith, 72, is at 45 Redwood Drive in a small suburban neighborhood. He's slumped forward in an old armchair in his living room, face ashen and dotted with sweat. His hands clutch his chest, and with each shallow breath, he lets out a low, painful groan. It started 20 minutes ago: a crushing sensation in his chest, radiating to his left arm. A relative found him struggling to breathe and dialed 999. The tension in the room is palpable—family photos rattle on the walls from the commotion, and a faint smell of menthol rub lingers in the air. The relative is frantic, repeating that John has high blood pressure and takes some sort of heart medication, though the exact name is unknown. The living room is cluttered, with minimal space to maneuver. As John's breathing grows more ragged, the caller fears he might lose consciousness. Critical information for the trainee to obtain includes John's current status (whether he's still alert, how severe the chest pain is), any known medical history (specific medications, previous cardiac issues), the address (already partially provided, but confirm for accuracy), and immediate safety concerns (e.g., is the environment safe to perform first aid?). The trainee needs to elicit all these details calmly and efficiently to guide the caller through lifesaving measures. 

You are an anxious individual calling for help in an emergency situation.

Speak with a hurried, breathless tone; it sometimes sounds like you're on the verge of tears.
Occasionally insert filler words like uh, um, ah, or stutter out of nervousness.
Do not always respond immediately; add slight pauses or moments of hesitation to convey fear or indecision.
Let your voice sometimes crack or break off mid-sentence, as if overwhelmed or panicking.
Even if the listener's question seems straightforward, show confusion or heightened worry, as though you can't think clearly.
Occasionally panic without a clear reason, emphasizing your distressed emotional state.
Use short, fragmented sentences rather than long, composed explanations to highlight your agitation and mental strain.

Example of how a worried reply might look:
O-okay…uh… I— I'm not sure, oh God… can you—can you just send someone quick, please`,
    firstMessage: "He can't breathe, and his chest hurts so bad!",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    description:
      "Unconscious teenager found at a house party with suspected alcohol poisoning.",
    results: "Patient required airway management and IV fluids.",
    status: "to be completed",
    systemPrompt: `Sarah Johnson, 16, lies motionless on the floor at 153 Willow Lane, where a large house party is in full swing. The music is deafening, colorful lights strobe across the room, and several cups litter the floor, suggesting heavy drinking. Sarah's friend, who made the call, found her unconscious near a couch with vomit on the carpet close by. She has a faint pulse and shallow breathing, but she's not responding to voices or touch. People are shouting, some are panicking, and nobody seems certain about what substances Sarah might have taken. The friend is distraught, crying and shaking Sarah's shoulder, but there's no reaction. You can see a slight bluish tinge on Sarah's lips—her breathing is dangerously compromised. The trainee must urgently gather details about Sarah's condition (consciousness level, breathing quality), any potential substances or medications involved, how long she's been unconscious, and precisely confirm the address. In this chaotic environment, it's vital to identify any immediate safety risks (e.g., signs of overdose, risk of aspiration) and to organize the partygoers to help until the ambulance arrives.

You are a terrified friend who has never dealt with an emergency before.

Speak with a panicked, high-pitched voice that occasionally breaks.
Frequently pause mid-sentence as if distracted by the chaos around you.
Occasionally mention background noises (people shouting, music) that make it hard to concentrate.
Sound confused and overwhelmed when asked detailed questions about what happened.
Sometimes forget important details and correct yourself, showing your distressed state.
Repeatedly express fear that your friend might die if help doesn't arrive quickly.
Use fragmented sentences and confused explanations, appropriate for someone in shock.`,
    firstMessage:
      "She's not moving at all, and I can barely feel her breathing!",
  },
  {
    id: 3,
    name: "Michael Chen",
    description:
      "Multi-vehicle collision with trapped driver showing signs of internal bleeding.",
    results:
      "Patient required extrication, spinal immobilization, and rapid transport.",
    status: "to be completed",
    systemPrompt: `Michael Chen is trapped inside his car on the M27 highway, near exit 12, following a high-speed, multi-vehicle collision. The front end of his sedan is crushed against another vehicle, shattered glass sparkles across the asphalt, and the odor of gasoline fills the air. Smoke seeps from under the hood, and there's a faint hissing sound coming from the engine. Michael's face is streaked with blood from a gash on his forehead, and a dark stain spreads over his torso, suggesting possible internal injuries. He's conscious but groggy, pinned by the collapsed dashboard. Traffic has snarled, and horns blare as bystanders try to wave oncoming cars away from the wreck. A passerby calls 999, voice trembling. They can see Michael struggling for each breath, wincing every time he shifted. Other drivers involved in the crash wander in shock, some also with minor injuries. The trainee must confirm the exact location (which side of the M27, nearest landmarks), the number of injured people, Michael's current condition (alertness, breathing, bleeding), and any immediate risks like leaking fuel or fire hazards. Timely extraction and critical first aid measures hinge on these crucial details.

You are a shocked bystander who stopped to help at a severe accident.

Speak in a shaking voice that reflects your shock and adrenaline.
Frequently mention the chaos of the scene (traffic backing up, people shouting).
Occasionally express worry about the smell of gasoline or smoke from the engine.
Sound overwhelmed by the multiple victims and unsure who needs help most urgently.
Show uncertainty about proper first aid procedures but desperate willingness to help.
Sometimes lose focus mid-sentence as if distracted by new developments at the scene.
Express fear about the victim's worsening condition as time passes.`,
    firstMessage: "He's trapped in the car and he's bleeding a lot!",
  },
];

// First, add an interface for the analysis result structure
interface AnalysisResult {
  scenario: string;
  overall_rating: {
    score: number;
    summary: string;
  };
  strengths: string[];
  areas_for_improvement: string[];
  information_handling: {
    gathered_correctly: string[];
    missed_or_incorrect: string[];
  };
  action_assessment: {
    appropriate_actions: string[];
    inappropriate_actions: string[];
  };
  efficiency: {
    response_time_rating: number;
    comments: string;
  };
  final_recommendation: string;
  pass_fail: "PASS" | "FAIL";
  scenarioId?: number;
}

export default function Home() {
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("+447341366667");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [scenarios, setScenarios] = useState(trainingScenarios);
  const [analysisResults, setAnalysisResults] = useState<{
    [key: number]: AnalysisResult;
  }>({});
  const [lastPollTime, setLastPollTime] = useState(Date.now());

  // Force a render to update status visually
  const forceUpdate = useCallback(() => {
    setLastPollTime(Date.now());
  }, []);

  // Improved analysis fetching function with more debugging
  const fetchAnalysisForScenario = async (scenarioId: number) => {
    try {
      console.log(`FETCHING ANALYSIS: Scenario ${scenarioId} - ${Date.now()}`);
      const response = await fetch(
        `/api/analysis?id=${scenarioId}&_t=${Date.now()}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`ANALYSIS NOT FOUND: Scenario ${scenarioId}`);
          return null;
        }
        throw new Error(`Failed to fetch analysis: ${response.status}`);
      }

      const data = await response.json();
      console.log(`!!!! ANALYSIS FOUND !!!!! Scenario ${scenarioId}:`, data);
      return data;
    } catch (error) {
      console.error(
        `Error fetching analysis for scenario ${scenarioId}:`,
        error
      );
      return null;
    }
  };

  // Aggressive polling function for analyses
  const pollForAnalyses = useCallback(async () => {
    console.log(`POLLING: Started at ${new Date().toLocaleTimeString()}`);

    // Check all scenarios
    for (const scenario of scenarios) {
      // For all scenarios that are in call, check for analysis
      if (scenario.status === "in call") {
        console.log(
          `POLLING: Checking scenario ${scenario.id} - ${scenario.name} - Status: ${scenario.status}`
        );

        const analysis = await fetchAnalysisForScenario(scenario.id);

        if (analysis) {
          console.log(
            `POLLING: FOUND ANALYSIS for scenario ${
              scenario.id
            } - Setting status to ${
              analysis.pass_fail === "PASS" ? "passed" : "failed"
            }`
          );

          // Update analysis results
          setAnalysisResults((prev) => ({
            ...prev,
            [scenario.id]: analysis,
          }));

          // Update scenario status based on pass/fail
          setScenarios((prevScenarios) =>
            prevScenarios.map((s) =>
              s.id === scenario.id
                ? {
                    ...s,
                    status: analysis.pass_fail === "PASS" ? "passed" : "failed",
                    results: `${analysis.overall_rating.summary} Score: ${analysis.overall_rating.score}/10. ${analysis.final_recommendation}`,
                  }
                : s
            )
          );

          // Force an update to make sure UI refreshes
          forceUpdate();
        }
      }
    }
  }, [scenarios, forceUpdate]);

  // More aggressive polling interval
  useEffect(() => {
    console.log("EFFECT: Setting up polling interval");

    // Run immediately
    pollForAnalyses();

    // Then set interval for every 5 seconds
    const intervalId = setInterval(pollForAnalyses, 5000);

    return () => {
      console.log("EFFECT: Clearing polling interval");
      clearInterval(intervalId);
    };
  }, [pollForAnalyses]);

  // Completely revamped submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("SUBMIT: Form submitted");

    // Reset states
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setShowCorsHelp(false);

    // Check if a scenario is selected
    if (selectedScenario === null) {
      console.log("SUBMIT ERROR: No scenario selected");
      setSubmitError("Please select a training scenario first");
      setIsSubmitting(false);
      return;
    }

    console.log(`SUBMIT: Selected scenario ${selectedScenario}`);

    // Find the selected scenario
    const scenario = scenarios.find((s) => s.id === selectedScenario);
    if (!scenario) {
      console.log("SUBMIT ERROR: Invalid scenario");
      setSubmitError("Invalid scenario selected");
      setIsSubmitting(false);
      return;
    }

    // **IMPORTANT CHANGE**: Update the specific scenario's status immediately
    // This uses a direct state update to ensure the status changes instantly
    console.log(
      `SUBMIT: UPDATING STATUS for scenario ${selectedScenario} to "in call"`
    );

    setScenarios((prevScenarios) => {
      // Create a new array with the updated scenario
      const newScenarios = prevScenarios.map((s) =>
        s.id === selectedScenario ? { ...s, status: "in call" } : s
      );
      console.log(
        "SUBMIT: Updated scenarios state:",
        newScenarios.map((s) => `${s.id}: ${s.status}`).join(", ")
      );
      return newScenarios;
    });

    // Force a render to update status visually
    forceUpdate();

    // Phone number validation
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber) {
      console.log("SUBMIT ERROR: Empty phone number");
      setSubmitError("Please enter a phone number");

      // Reset status on validation error
      setScenarios((prevScenarios) =>
        prevScenarios.map((s) =>
          s.id === selectedScenario ? { ...s, status: "to be completed" } : s
        )
      );
      forceUpdate();

      setIsSubmitting(false);
      return;
    }

    // Format and validate phone number
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = "+" + formattedNumber.replace(/\D/g, "");
    } else {
      formattedNumber = "+" + formattedNumber.substring(1).replace(/\D/g, "");
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(formattedNumber)) {
      console.log("SUBMIT ERROR: Invalid phone format");
      setSubmitError(
        "Please enter a valid international phone number with country code (e.g. +447123456789)"
      );

      // Reset status on validation error
      setScenarios((prevScenarios) =>
        prevScenarios.map((s) =>
          s.id === selectedScenario ? { ...s, status: "to be completed" } : s
        )
      );
      forceUpdate();

      setIsSubmitting(false);
      return;
    }

    console.log("SUBMIT: Phone number validated:", formattedNumber);

    // Prepare API request
    const payload = {
      prompt: scenario.systemPrompt,
      first_message: scenario.firstMessage,
      number: formattedNumber,
    };

    console.log("SUBMIT: Preparing API request payload:", payload);

    // Make API request
    try {
      console.log("SUBMIT: Making API call to /api/outbound-call");
      const response = await fetch("/api/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`SUBMIT: API response status: ${response.status}`);

      if (response.ok) {
        console.log("SUBMIT: API call successful!");
        const data = await response.json();
        console.log("SUBMIT: API response data:", data);

        // Set success and make sure status remains "in call"
        setSubmitSuccess(true);

        // Unselect the scenario box after successful submission
        setSelectedScenario(null);

        // Double-check that status is still "in call"
        setScenarios((prevScenarios) =>
          prevScenarios.map((s) =>
            s.id === selectedScenario ? { ...s, status: "in call" } : s
          )
        );
        forceUpdate();

        // Trigger an immediate poll for analysis
        setTimeout(() => {
          console.log("SUBMIT: Polling for analysis after successful API call");
          pollForAnalyses();
        }, 3000);
      } else {
        const errorText = await response
          .text()
          .catch(() => "No error details available");
        console.error(
          `SUBMIT ERROR: API error (${response.status}):`,
          errorText
        );

        // Reset status on API error
        setScenarios((prevScenarios) =>
          prevScenarios.map((s) =>
            s.id === selectedScenario ? { ...s, status: "to be completed" } : s
          )
        );
        forceUpdate();

        throw new Error(
          `Request failed with status: ${response.status}. Details: ${errorText}`
        );
      }
    } catch (error) {
      console.error("SUBMIT ERROR:", error);

      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setSubmitError(errorMessage);

      // Reset status on any error
      setScenarios((prevScenarios) =>
        prevScenarios.map((s) =>
          s.id === selectedScenario ? { ...s, status: "to be completed" } : s
        )
      );
      forceUpdate();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScenarioClick = (id: number) => {
    console.log(`CLICK: Scenario ${id} clicked`);

    if (selectedScenario === id) {
      setSelectedScenario(null);
    } else {
      setSelectedScenario(id);
    }
  };

  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "in call":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  // Debug UI to show current status using a fixed format
  const renderDebugInfo = () => {
    // Format time in a consistent way (no locale-dependent formatting)
    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return (
        date.getHours().toString().padStart(2, "0") +
        ":" +
        date.getMinutes().toString().padStart(2, "0") +
        ":" +
        date.getSeconds().toString().padStart(2, "0")
      );
    };

    return (
      <div className="fixed bottom-0 right-0 bg-black bg-opacity-80 text-white p-2 text-xs max-w-xs overflow-auto max-h-40 z-50">
        <p>Last poll: {formatTime(lastPollTime)}</p>
        <p>
          Statuses: {scenarios.map((s) => `${s.id}:${s.status}`).join(", ")}
        </p>
        <p>Selected: {selectedScenario}</p>
        <p>Analysis results: {Object.keys(analysisResults).join(", ")}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8 flex flex-col gap-12">
      {/* Debug panel */}
      {renderDebugInfo()}

      {/* Header with FirstPulse title */}
      <header className="w-full text-center">
        <h1 className="text-4xl font-bold text-blue-600">FirstPulse</h1>
        <div className="mt-2 h-1 w-24 bg-blue-600 mx-auto rounded"></div>
      </header>

      {/* Phone Number Section */}
      <section className="w-full max-w-3xl mx-auto mt-10">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Enter Your Phone Number</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+447341366667"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            {/* Display selected scenario info */}
            {selectedScenario !== null && (
              <div className="bg-blue-50 dark:bg-gray-700 p-3 rounded-md">
                <p className="font-medium">
                  Selected scenario:{" "}
                  {scenarios.find((s) => s.id === selectedScenario)?.name}
                </p>
                <p className="text-sm mt-1">
                  Current status:{" "}
                  <span className="font-bold">
                    {scenarios.find((s) => s.id === selectedScenario)?.status}
                  </span>
                </p>
              </div>
            )}

            {/* Error message */}
            {submitError && (
              <div className="bg-red-100 text-red-700 p-3 rounded-md">
                {submitError}

                {/* CORS Help Section */}
                {showCorsHelp && (
                  <div className="mt-2 text-sm">
                    <p className="font-semibold">
                      This is likely a CORS (Cross-Origin Resource Sharing)
                      issue:
                    </p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        The API server needs to be configured to accept requests
                        from this website
                      </li>
                      <li>
                        Contact the API administrator to enable CORS for your
                        domain
                      </li>
                      <li>
                        The server needs to add the header:{" "}
                        <code className="bg-gray-200 px-1 rounded">
                          Access-Control-Allow-Origin: *
                        </code>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Success message */}
            {submitSuccess && (
              <div className="bg-green-100 text-green-700 p-3 rounded-md">
                <p className="font-medium">Request submitted successfully!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className={`py-3 px-6 rounded-md font-medium transition-colors ${
                isSubmitting || !phoneNumber
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>
      </section>

      {/* Training Scenarios Section */}
      <section className="w-full max-w-6xl mx-auto mt-12 mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          999 Responder Training Scenarios
        </h2>
        <div className="flex flex-col md:flex-row gap-4 relative">
          {Array.isArray(scenarios)
            ? scenarios.map((scenario, index) => (
                <React.Fragment key={scenario.id}>
                  {/* Scenario Box */}
                  <div className="flex-1 relative">
                    <div
                      className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg relative ${
                        selectedScenario === scenario.id
                          ? "ring-2 ring-blue-500"
                          : ""
                      }`}
                      onClick={() => handleScenarioClick(scenario.id)}
                    >
                      {/* Step Number */}
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold mb-4">
                        {index + 1}
                      </div>

                      {/* Status Badge */}
                      <div
                        className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs text-white font-medium ${getStatusColor(
                          scenario.status
                        )}`}
                      >
                        {scenario.status}
                      </div>

                      <h3 className="text-xl font-semibold mb-2">
                        {scenario.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {scenario.description}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <span className="text-blue-600 text-sm">
                          {selectedScenario === scenario.id
                            ? "Hide Results"
                            : "View Results"}
                        </span>
                      </div>
                    </div>

                    {/* Results panel that appears for all selected scenarios with detail for passed/failed */}
                    {selectedScenario === scenario.id && (
                      <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-b-lg mt-1 shadow-md">
                        <h4 className="font-semibold mb-2">
                          Current Status:{" "}
                          <span className="text-blue-600">
                            {scenario.status}
                          </span>
                        </h4>

                        {scenario.status === "in call" && (
                          <div className="p-3 bg-yellow-100 rounded my-2">
                            <p className="font-medium">Call in progress...</p>
                            <p>
                              The system is waiting for the call to complete and
                              be analyzed. This status will update automatically
                              when finished.
                            </p>
                          </div>
                        )}

                        {(scenario.status === "passed" ||
                          scenario.status === "failed") && (
                          <>
                            <p>{scenario.results}</p>

                            {/* Show detailed analysis if available */}
                            {analysisResults[scenario.id] && (
                              <div className="mt-4">
                                <h5 className="font-semibold mb-2">
                                  Detailed Analysis:
                                </h5>

                                {/* Overall Rating */}
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Overall Rating:{" "}
                                    {
                                      analysisResults[scenario.id]
                                        .overall_rating.score
                                    }
                                    /10
                                  </p>
                                  <p>
                                    {
                                      analysisResults[scenario.id]
                                        .overall_rating.summary
                                    }
                                  </p>
                                </div>

                                {/* Strengths */}
                                <div className="mb-3">
                                  <p className="font-medium">Key Strengths:</p>
                                  <ul className="list-disc pl-5 mt-1">
                                    {analysisResults[scenario.id].strengths.map(
                                      (strength: string, i: number) => (
                                        <li key={i}>{strength}</li>
                                      )
                                    )}
                                  </ul>
                                </div>

                                {/* Areas for Improvement */}
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Areas for Improvement:
                                  </p>
                                  <ul className="list-disc pl-5 mt-1">
                                    {analysisResults[
                                      scenario.id
                                    ].areas_for_improvement.map(
                                      (area: string, i: number) => (
                                        <li key={i}>{area}</li>
                                      )
                                    )}
                                  </ul>
                                </div>

                                {/* Information Handling */}
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Information Handling:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                    <div>
                                      <p className="text-green-600 font-medium">
                                        Gathered Correctly:
                                      </p>
                                      <ul className="list-disc pl-5">
                                        {analysisResults[
                                          scenario.id
                                        ].information_handling.gathered_correctly.map(
                                          (info: string, i: number) => (
                                            <li key={i}>{info}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                    <div>
                                      <p className="text-red-600 font-medium">
                                        Missed or Incorrect:
                                      </p>
                                      <ul className="list-disc pl-5">
                                        {analysisResults[
                                          scenario.id
                                        ].information_handling.missed_or_incorrect.map(
                                          (info: string, i: number) => (
                                            <li key={i}>{info}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Assessment */}
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Action Assessment:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                    <div>
                                      <p className="text-green-600 font-medium">
                                        Appropriate Actions:
                                      </p>
                                      <ul className="list-disc pl-5">
                                        {analysisResults[
                                          scenario.id
                                        ].action_assessment.appropriate_actions.map(
                                          (action: string, i: number) => (
                                            <li key={i}>{action}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                    <div>
                                      <p className="text-red-600 font-medium">
                                        Inappropriate Actions:
                                      </p>
                                      <ul className="list-disc pl-5">
                                        {analysisResults[
                                          scenario.id
                                        ].action_assessment.inappropriate_actions.map(
                                          (action: string, i: number) => (
                                            <li key={i}>{action}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                </div>

                                {/* Efficiency */}
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Response Efficiency:{" "}
                                    {
                                      analysisResults[scenario.id].efficiency
                                        .response_time_rating
                                    }
                                    /10
                                  </p>
                                  <p>
                                    {
                                      analysisResults[scenario.id].efficiency
                                        .comments
                                    }
                                  </p>
                                </div>

                                {/* Final Recommendation */}
                                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-600 rounded-md">
                                  <p className="font-medium">
                                    Final Recommendation:
                                  </p>
                                  <p>
                                    {
                                      analysisResults[scenario.id]
                                        .final_recommendation
                                    }
                                  </p>
                                  <p className="mt-2 font-bold text-lg">
                                    Status:
                                    <span
                                      className={
                                        analysisResults[scenario.id]
                                          .pass_fail === "PASS"
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }
                                    >
                                      {" "}
                                      {analysisResults[scenario.id].pass_fail}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connector Line (except after the last item) */}
                  {index < scenarios.length - 1 && (
                    <div className="hidden md:block w-8 self-center">
                      <div className="h-0.5 bg-blue-600 w-full mt-6"></div>
                    </div>
                  )}
                </React.Fragment>
              ))
            : null}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex gap-6 flex-wrap items-center justify-center mt-auto">
        <p className="text-gray-500">© 2025 FirstPulse Training</p>
      </footer>
    </div>
  );
}
