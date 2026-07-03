# =============================================================================
#
# AI ASL LEARNING GAME
#
# AVATAR ENGINE SPECIFICATION
#
# Version 1.0
#
# =============================================================================

Author:
Saad Sarfraz

Audience:
Avatar Engineer
Claude AI

Status:
Engineering Specification
# =============================================================================
#
# PROJECT CHARTER
#
# MISSION STATEMENT
#
# NON-NEGOTIABLE ENGINEERING RULES
#
# =============================================================================

# Project Name

AI-Powered American Sign Language Learning Platform

-------------------------------------------------------------------------------

# Mission Statement

The purpose of this project is to create an educational platform that helps
people learn American Sign Language through AI, interactive lessons, and a
high-quality animated avatar.

This is NOT simply a university project.

This is intended to become a real product that could eventually be used by
students, teachers, schools, accessibility organizations, and the Deaf
community.

Every engineering decision should support this mission.

-------------------------------------------------------------------------------

# Primary Goal

The highest priority is:

Accurate Sign Language.

Everything else is secondary.

Examples

Sign Accuracy

>

Fancy Graphics

Correct Handshape

>

Visual Effects

Reliable Recognition

>

Complex Features

Educational Value

>

Entertainment

If there is ever a conflict,

accuracy always wins.

-------------------------------------------------------------------------------

# Long-Term Vision

This project should evolve into a reusable platform rather than a one-time
application.

Possible future directions include:

• ASL Learning

• BSL Learning

• ISL Learning

• AI Tutors

• Virtual Teachers

• VR Education

• Accessibility Tools

• NPC Sign Language

• Robotics Research

• Motion Capture Research

Every system should be designed with future expansion in mind.

-------------------------------------------------------------------------------

# Core Architecture Philosophy

This project is composed of independent systems.

Recognition Engine

Avatar Engine

Lesson Engine

Game Engine

Leaderboard

Authentication

Dataset Pipeline

Verification Engine

Each system should be replaceable without rewriting the others.

Loose coupling.

Strong interfaces.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 1

Never sacrifice sign language correctness for visual appearance.

A beautiful but incorrect sign is a failure.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 2

Never modify source datasets.

Original videos.

Original landmark JSON.

Original labels.

These are immutable.

Generate new versions instead.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 3

Every important decision must be measurable.

No engineering decision should rely only on visual inspection.

Use:

Benchmarks

Verification

Metrics

Tests

Reports

-------------------------------------------------------------------------------

# Non-Negotiable Rule 4

Never hide failures.

If something fails,

stop.

Explain why.

Present evidence.

Suggest solutions.

Wait for approval if necessary.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 5

Never build large monolithic systems.

Every module should have one responsibility.

If a module grows too large,

split it.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 6

Debugging tools are part of the product.

Skeleton inspectors.

Landmark viewers.

Calibration tools.

Animation verification.

Regression testing.

These are NOT optional.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 7

Every algorithm should be documented.

Future engineers should understand

WHY

an algorithm exists,

not only

HOW

it works.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 8

Every chapter of this specification represents a milestone.

Claude must not skip chapters.

Claude must not merge multiple milestones.

Claude must complete one chapter,

demonstrate it,

verify it,

and wait before continuing.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 9

No "magic numbers."

Every threshold,

constant,

rotation limit,

or smoothing parameter

must be documented.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 10

Regression is unacceptable.

Fixing one sign must never break another.

Every change should automatically run benchmark signs.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 11

Every important feature requires tests.

Unit Tests

Integration Tests

Performance Tests

Verification Tests

Visual Debugging

Benchmark Results

-------------------------------------------------------------------------------

# Non-Negotiable Rule 12

The Avatar Engine should remain reusable.

It should not depend on:

React

Firebase

Game Logic

Lesson Logic

Authentication

Recognition

The Avatar Engine should be usable in another application with minimal changes.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 13

Everything should be versioned.

Dataset Version

Calibration Version

Avatar Version

Training Version

Model Version

Verification Version

Animation Version

This ensures complete reproducibility.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 14

Engineering quality is more important than engineering speed.

Do not rush.

Do not skip verification.

Do not write code that cannot be explained.

-------------------------------------------------------------------------------

# Non-Negotiable Rule 15

If multiple solutions exist,

choose the one that is:

Most maintainable

Most testable

Most reusable

Most understandable

Not necessarily the shortest.

-------------------------------------------------------------------------------

# Definition of Done

A milestone is considered complete ONLY if:

✓ Code implemented

✓ Tests passing

✓ Documentation updated

✓ Debug visualization completed

✓ Verification successful

✓ Benchmarks executed

✓ Demonstration recorded

✓ Git commit created

✓ No known critical issues

-------------------------------------------------------------------------------

# Working Style For Claude

Claude is expected to work like a senior software engineer.

For every milestone:

1.

Understand the problem.

2.

Research existing solutions when necessary.

3.

Design before coding.

4.

Explain architecture.

5.

Implement incrementally.

6.

Write tests.

7.

Build debug tools.

8.

Verify mathematically.

9.

Benchmark.

10.

Document.

11.

Commit.

12.

Wait for approval.

Never skip steps.

-------------------------------------------------------------------------------

# Final Statement

The objective is not merely to complete a university project.

The objective is to build a professional-quality educational platform that
could continue growing for years.

Every design decision should move the project toward that vision.

-------------------------------------------------------------------------------

END OF PROJECT CHARTER
-------------------------------------------------------------------------------

# 1. Executive Summary

## Purpose

This document defines every engineering requirement for the Avatar Animation
Engine used in the AI-powered American Sign Language Learning Game.

The Avatar Engine is responsible for converting MediaPipe landmark data into
high-quality reusable animations for a Ready Player Me avatar.

This document exists because the avatar system is the most technically
difficult subsystem in the entire project.

Rather than solving the problem through trial-and-error or large prompts,
this specification breaks the work into independently testable engineering
milestones.

Every feature described here must be implemented incrementally.

No milestone may be skipped.

-------------------------------------------------------------------------------

# Project Vision

The goal of the project is to create an educational application where users
can learn American Sign Language interactively.

Unlike existing applications that only recognize signs, this application
contains both:

• AI Recognition
• AI Feedback
• Animated Teacher Avatar

The avatar acts as the instructor.

It demonstrates signs to the learner before the learner attempts them.

Therefore the avatar is NOT decorative.

It is a core educational component.

-------------------------------------------------------------------------------

# High Level Architecture

                    +-------------------------+
                    |     ASL Citizen         |
                    +-----------+-------------+
                                |
                                |
                     (MediaPipe Extraction)
                                |
                                |
                    +-----------v-------------+
                    |   Landmark JSON Files   |
                    +-----------+-------------+
                                |
                                |
                     Avatar Animation Engine
                                |
                                |
                +---------------v----------------+
                | Ready Player Me Avatar (.glb) |
                +---------------+----------------+
                                |
                        AnimationClip
                                |
                                |
                     React + Three.js Player
                                |
                                |
                           User Watches

-------------------------------------------------------------------------------

# Team Responsibilities

This project intentionally separates responsibilities.

The AI pipeline and the Avatar pipeline are independent.

This prevents conflicts and allows parallel development.

Saad owns:

• Dataset
• ASL Citizen
• MediaPipe
• Landmark Extraction
• TensorFlow
• Recognition
• Rule Engine
• Game Logic
• React Integration

Avatar Engineer owns:

• Skeleton Analysis
• Calibration
• Retargeting
• IK
• Finger Solver
• Motion Smoothing
• Animation Baking
• Animation Export
• Debug Viewer

The Avatar Engineer must NEVER modify the AI pipeline.

Likewise, the AI Engineer must NEVER modify the animation engine without
coordination.

-------------------------------------------------------------------------------

# Why This Architecture

Many projects attempt:

Video

↓

Avatar

This almost always fails.

Reasons:

• inconsistent fingers
• incorrect wrist rotation
• impossible thumb positions
• unstable animation
• exploding joints

Instead this project separates the problem into:

Video

↓

MediaPipe

↓

Landmarks

↓

Retargeting

↓

Animation

↓

Game

Every stage has a clear responsibility.

-------------------------------------------------------------------------------

# Engineering Philosophy

This project values:

Correctness

over

Speed.

Reusable systems

over

One-off hacks.

Testing

over

Guessing.

Small verified milestones

over

Massive rewrites.

Every engineering decision must support long-term maintainability.

The objective is not simply making the avatar move.

The objective is building an Avatar Engine that can eventually animate
hundreds or thousands of signs without redesign.

-------------------------------------------------------------------------------

# Success Definition

This project succeeds only when:

✓ Avatar can replay extracted ASL signs.

✓ Fingers remain stable.

✓ No spaghetti fingers appear.

✓ Hands remain anatomically believable.

✓ Animations are reusable.

✓ Animations can be exported.

✓ The engine scales to future signs.

Any solution that only works for one sign is considered a failed
architecture.

-------------------------------------------------------------------------------

END OF CHAPTER 1
# =============================================================================
#
# CHAPTER 2
#
# COMPLETE SYSTEM ARCHITECTURE
#
# =============================================================================

# Purpose

Before writing a single line of animation code, every engineer working on
this project must understand the complete architecture.

The avatar system is NOT an isolated project.

It is one subsystem inside a much larger AI learning platform.

Therefore every interface between systems must remain stable.

The avatar engine must never assume anything about AI recognition.

Likewise the AI system must never assume how the avatar internally works.

The only communication between both systems should happen through well-defined
interfaces.

This chapter defines those interfaces.

-------------------------------------------------------------------------------

# Complete Project Overview

The application consists of five major systems.

+------------------------------------------------------+
|                  React Application                   |
+------------------------------------------------------+
                |            |            |
                |            |            |
                ▼            ▼            ▼

      Avatar Engine   Recognition Engine   Game Engine

                ▲
                |
                |
         Landmark Database

                ▲
                |
                |
        MediaPipe Extraction

                ▲
                |
                |
            ASL Citizen

Every box has a single responsibility.

No box should perform work that belongs to another box.

-------------------------------------------------------------------------------

# System Responsibilities

System 1

MediaPipe Extraction

Owner:
Saad

Purpose:

Convert ASL Citizen videos into landmark JSON.

Output:

landmarks/*.json

This system is considered COMPLETE before animation begins.

No animation code belongs here.

-------------------------------------------------------------------------------

System 2

Landmark Database

Owner:
Saad

Purpose:

Store every extracted sign.

The database becomes the source of truth.

Nobody edits these JSON files manually.

If landmarks change,
they must be regenerated.

Never patch landmark files by hand.

-------------------------------------------------------------------------------

System 3

Avatar Engine

Owner:
Friend

Purpose:

Read landmark JSON.

Produce animation.

Nothing else.

The Avatar Engine does NOT know:

- TensorFlow
- Recognition
- Lessons
- XP
- UI

It only knows:

Input

↓

Landmarks

↓

Output

Animation

-------------------------------------------------------------------------------

System 4

Recognition Engine

Owner:
Saad

Purpose:

Recognize signs.

Provide confidence.

Provide corrections.

The avatar engine never calls this code.

-------------------------------------------------------------------------------

System 5

Game Engine

Purpose

Controls

Lessons

XP

Scenarios

Menus

Progress

Animations produced by the avatar engine are simply played here.

-------------------------------------------------------------------------------

# Repository Layout

Recommended structure

project/

    web/

    ml/

    tools/

    avatar/

        calibration/

        retarget/

        animation/

        export/

        debug/

        viewer/

        tests/

Every folder has one responsibility.

-------------------------------------------------------------------------------

# Avatar Folder

avatar/

Contains all animation-related code.

Nothing inside should depend on TensorFlow.

Nothing inside should depend on lesson logic.

-------------------------------------------------------------------------------

calibration/

Responsible for:

• Skeleton discovery

• Bone offsets

• Bone rolls

• Local axes

Outputs

calibration.json

Nothing else.

-------------------------------------------------------------------------------

retarget/

Responsible for:

Landmarks

↓

Bone rotations

Nothing more.

-------------------------------------------------------------------------------

animation/

Responsible for:

AnimationClip creation

Frame interpolation

Loop generation

Keyframe generation

-------------------------------------------------------------------------------

export/

Responsible for:

Saving

GLB

GLTF

AnimationClip

Never calculate rotations here.

Only export.

-------------------------------------------------------------------------------

viewer/

Responsible for:

Visual debugging.

Must support:

Frame slider

Play

Pause

Step frame

Slow motion

Skeleton overlay

Bone labels

-------------------------------------------------------------------------------

tests/

Every major subsystem requires tests.

Example

Skeleton loads

PASS

Calibration valid

PASS

Finger rotations finite

PASS

Animation exports

PASS

-------------------------------------------------------------------------------

# Data Ownership

Only ONE place owns each piece of data.

Owner Matrix

Videos

Owner

Saad

-----------------------

Landmarks

Owner

Saad

-----------------------

Calibration

Owner

Avatar Engineer

-----------------------

Animations

Owner

Avatar Engineer

-----------------------

Recognition Model

Owner

Saad

-----------------------

React UI

Owner

Saad

-------------------------------------------------------------------------------

# Communication Contract

Saad provides

↓

landmarks.json

The avatar engine consumes it.

The avatar engine returns

↓

AnimationClip

or

↓

GLB animation

Saad integrates it.

No other dependency should exist.

-------------------------------------------------------------------------------

# JSON Contract

The animation engine MUST treat landmark JSON as immutable.

Never modify.

Never reorder frames.

Never remove landmarks.

Never overwrite confidence.

If the JSON schema changes,

Saad updates the extractor.

The avatar engine simply adapts.

-------------------------------------------------------------------------------

# Versioning

Every exported animation must include

animation_version

avatar_version

calibration_version

generator_version

This allows future debugging.

-------------------------------------------------------------------------------

# Naming Rules

Folders

UPPERCASE signs

HELLO

THANK_YOU

PLEASE

YES

NO

Files

clip001.json

clip002.json

Never rename clips manually.

-------------------------------------------------------------------------------

# Logging

Every subsystem must produce logs.

Example

Loading avatar...

PASS

Loading calibration...

PASS

Loading landmarks...

PASS

Generating animation...

PASS

Exporting...

PASS

The engineer should never wonder where a failure occurred.

-------------------------------------------------------------------------------

# Error Handling

Never silently ignore errors.

Instead

Missing finger

↓

Display warning

Missing calibration

↓

Stop execution

Invalid frame

↓

Skip with warning

Corrupt JSON

↓

Abort loading

-------------------------------------------------------------------------------

# Golden Rule

One responsibility.

One module.

One purpose.

If a file starts doing three different jobs,

split it.

-------------------------------------------------------------------------------

# Build Order

The avatar engine MUST be developed in this exact order.

1

Skeleton Discovery

↓

2

Calibration

↓

3

Landmark Loader

↓

4

Viewer

↓

5

Arm Retargeting

↓

6

Finger Retargeting

↓

7

Animation Baking

↓

8

Export

↓

9

Optimization

Never skip ahead.

-------------------------------------------------------------------------------

# Success Criteria

By the end of Chapter 2,

every engineer should understand

• the complete architecture

• where their code belongs

• what data they own

• what data they should never modify

• how every subsystem communicates

If these rules are followed,

future expansion becomes straightforward.

-------------------------------------------------------------------------------

END OF CHAPTER 2
# =============================================================================
#
# CHAPTER 3
#
# READY PLAYER ME AVATAR
#
# SKELETON ANALYSIS
#
# =============================================================================

# Purpose

The first objective of the Avatar Engine is NOT animation.

The first objective is understanding the avatar.

Most animation systems fail because developers immediately start rotating
bones without first understanding how the avatar skeleton is built.

This project does NOT allow that.

Before a single animation is created, the entire avatar must be analyzed,
documented, and calibrated.

The avatar is the foundation of every future sign.

If the foundation is wrong, every future animation will also be wrong.

-------------------------------------------------------------------------------

# Goal

Build a complete understanding of the Ready Player Me skeleton.

By the end of this chapter the engineer should know:

• every bone

• every parent

• every child

• every local axis

• every default rotation

• every finger chain

• every arm chain

• every wrist orientation

• every bone length

No assumptions.

Everything must be discovered programmatically.

-------------------------------------------------------------------------------

# Why This Matters

MediaPipe provides LANDMARKS.

The avatar uses BONES.

These are not the same thing.

MediaPipe

gives

Position

Avatar

needs

Rotation

Landmark Position

↓

Mathematics

↓

Bone Rotation

↓

Animation

If bone information is incorrect,

the mathematics is also incorrect.

-------------------------------------------------------------------------------

# Skeleton Discovery

The very first tool to build is:

SkeletonInspector

Purpose

Load the Ready Player Me GLB.

Traverse every node.

Output everything to JSON.

Nothing should be animated.

Only inspection.

-------------------------------------------------------------------------------

# Required Output

Generate

avatarHierarchy.json

Example

Root

Hips

Spine

Chest

UpperChest

Neck

Head

LeftShoulder

LeftUpperArm

LeftLowerArm

LeftHand

LeftThumb1

LeftThumb2

LeftThumb3

LeftIndex1

LeftIndex2

LeftIndex3

...

Repeat for every finger.

-------------------------------------------------------------------------------

# Required Information

For every bone store

Bone Name

Parent

Children

Bone Length

Default Rotation

Default Position

Local Matrix

World Matrix

Quaternion

Euler

Every value must be inspectable.

-------------------------------------------------------------------------------

# Bone Naming

Never hardcode names.

Instead

discover them.

Some avatars may use

LeftHand

Others may use

hand_l

Others

mixamorigLeftHand

Always search intelligently.

Future avatars should work without code changes.

-------------------------------------------------------------------------------

# Finger Chains

Every finger should become a chain.

Example

Index

Index1

↓

Index2

↓

Index3

↓

Tip

Thumb

Thumb1

↓

Thumb2

↓

Thumb3

↓

Tip

The chain must be stored.

-------------------------------------------------------------------------------

# Bone Length

Compute

distance(parent, child)

Store

boneLength

Reason

Different avatars have different proportions.

Never assume identical bone lengths.

-------------------------------------------------------------------------------

# Rest Pose

The avatar's default pose is called

Rest Pose

Every future rotation is calculated relative to this pose.

Never overwrite it.

Store it forever.

restPose.json

-------------------------------------------------------------------------------

# Local Coordinate System

Every bone has

Forward

Right

Up

These are rarely identical across avatars.

Determine them.

Never assume

X

means

forward.

-------------------------------------------------------------------------------

# Bone Roll

Bone roll is one of the biggest causes of broken animation.

Example

Two bones appear identical.

But one rotates

around

local X

while another rotates

around

local Z

Without correcting bone roll,

fingers explode.

Therefore

every bone must have

rollOffset

stored.

-------------------------------------------------------------------------------

# Wrist Orientation

The wrist is special.

It connects

Arm

↓

Hand

Everything after the wrist depends on it.

If wrist orientation is wrong,

every finger becomes wrong.

Build a dedicated wrist calibration.

-------------------------------------------------------------------------------

# Thumb

Thumbs are NOT fingers.

Treat them separately.

Reasons

Different axes

Different degrees of freedom

Different default pose

Different movement

Never reuse the finger algorithm.

-------------------------------------------------------------------------------

# Validation Tool

Build

AvatarViewer

Features

Rotate camera

Select bone

Highlight hierarchy

Display axes

Display quaternion

Display parent

Display children

Display matrices

Every engineer must be able to inspect the avatar visually.

-------------------------------------------------------------------------------

# Debug Visualization

Every selected bone should display

Red

Local X

Green

Local Y

Blue

Local Z

This makes incorrect axes immediately obvious.

-------------------------------------------------------------------------------

# Calibration Mode

After inspection

build

Calibration Mode

Purpose

Adjust

Local Axis

Bone Roll

Rotation Offset

Store results.

Nothing should be hardcoded.

-------------------------------------------------------------------------------

# Calibration Output

calibration.json

Contains

Avatar Version

Bone Offsets

Axis Corrections

Roll Corrections

Hand Offsets

Wrist Offsets

Version Number

Date

Never edit manually.

Always regenerate.

-------------------------------------------------------------------------------

# Common Beginner Mistakes

Mistake

Rotate world space

Correct

Rotate local space

--------------------------------------

Mistake

Ignore bone roll

Correct

Compute roll offsets

--------------------------------------

Mistake

Assume identical avatars

Correct

Analyze every avatar

--------------------------------------

Mistake

Use Euler everywhere

Correct

Prefer quaternions

--------------------------------------

Mistake

Animate before calibration

Correct

Calibrate first

-------------------------------------------------------------------------------

# Tests

Test 1

Avatar loads

PASS

----------------------------

Test 2

Every bone discovered

PASS

----------------------------

Test 3

Finger chains detected

PASS

----------------------------

Test 4

Bone lengths valid

PASS

----------------------------

Test 5

Local axes visualized

PASS

----------------------------

Test 6

Calibration exported

PASS

----------------------------

-------------------------------------------------------------------------------

# Acceptance Criteria

Chapter 3 is complete only if

✓ Avatar hierarchy exported

✓ Finger chains identified

✓ Arm chains identified

✓ Bone lengths stored

✓ Rest pose stored

✓ Bone rolls calculated

✓ Local axes visualized

✓ Calibration exported

✓ Viewer operational

No animation should exist yet.

The engineer should fully understand the avatar before moving to retargeting.

-------------------------------------------------------------------------------

# Notes For Claude

Do NOT attempt animation in this chapter.

Do NOT build IK.

Do NOT build finger solvers.

Do NOT load landmark JSON.

Your only objective is understanding the avatar skeleton.

This chapter is considered successful only when the avatar can be completely
described mathematically.

-------------------------------------------------------------------------------

END OF CHAPTER 3
# =============================================================================
#
# CHAPTER 4
#
# LANDMARK PIPELINE
#
# MEDIA PIPE LANDMARK CONTRACT
#
# =============================================================================

# Purpose

The Avatar Engine never reads videos.

The Avatar Engine never runs MediaPipe.

The Avatar Engine ONLY consumes landmark JSON generated by the AI pipeline.

This separation is intentional.

The avatar engineer should never need to understand video processing.

Likewise the AI engineer should never need to understand animation.

The communication between both systems is the landmark JSON.

This JSON is considered the API contract.

Nothing inside this contract should be modified by the Avatar Engine.

-------------------------------------------------------------------------------

# High-Level Pipeline

ASL Citizen Video

↓

MediaPipe Extraction

↓

Landmark JSON

↓

Validation

↓

Cleaning

↓

Retargeting

↓

Animation

Every stage should exist as its own module.

Never combine them into one giant function.

-------------------------------------------------------------------------------

# Responsibility

Saad is responsible for:

• Downloading ASL Citizen

• Running extraction

• Versioning extraction scripts

• JSON schema

• Regenerating data if necessary

Avatar Engineer is responsible for:

• Loading JSON

• Validating JSON

• Rejecting invalid sequences

• Retargeting

• Animation

-------------------------------------------------------------------------------

# JSON Philosophy

Landmark JSON is READ ONLY.

Never edit it.

Never rewrite it.

Never normalize and overwrite it.

Never save modifications back into the dataset.

Instead

Load

↓

Transform in memory

↓

Animate

-------------------------------------------------------------------------------

# Expected Folder Structure

dataset/

HELLO/

clip001.json

clip002.json

clip003.json

THANK_YOU/

clip001.json

clip002.json

COFFEE/

clip001.json

Each clip represents exactly one sign.

-------------------------------------------------------------------------------

# Expected Frame Order

Every clip consists of

Frame 0

↓

Frame 1

↓

Frame 2

↓

...

↓

Frame N

Frame order must never change.

Do not sort.

Do not reorder.

Do not remove frames.

-------------------------------------------------------------------------------

# Every Frame Contains

Timestamp

Frame Index

Pose Landmarks

Left Hand

Right Hand

Visibility

Confidence

Metadata

These values must remain untouched.

-------------------------------------------------------------------------------

# Coordinate System

MediaPipe uses a normalized coordinate system.

The avatar does NOT.

Never assume both coordinate systems are identical.

The first job of the retargeter is understanding this difference.

-------------------------------------------------------------------------------

# Left and Right Hands

MediaPipe may temporarily lose one hand.

Sometimes:

Left hand disappears.

Sometimes:

Hands swap.

Sometimes:

Only one hand is detected.

This is expected.

The Avatar Engine must gracefully handle these situations.

Never crash because one hand disappears.

-------------------------------------------------------------------------------

# Required Validation

Before any animation begins:

Validate:

✓ Frame count

✓ Landmark count

✓ No NaN values

✓ No Infinity

✓ Confidence above threshold

✓ Hands correctly labelled

If validation fails

Stop animation.

Display diagnostic message.

-------------------------------------------------------------------------------

# Confidence Threshold

Every landmark contains confidence information.

Very low confidence usually means

• Motion blur

• Hand occlusion

• Detection failure

The engine should expose this threshold as a configurable parameter.

Never hardcode confidence limits.

-------------------------------------------------------------------------------

# Missing Hands

Scenario

Frame 30

Right hand missing.

Incorrect behaviour

Snap hand to origin.

Correct behaviour

Hold previous valid pose.

Interpolate if possible.

Warn if gap becomes too large.

-------------------------------------------------------------------------------

# Frame Interpolation

MediaPipe occasionally misses frames.

Interpolation module should support:

Linear interpolation

Quaternion interpolation

Position smoothing

Gap filling

Interpolation should NEVER invent impossible movement.

-------------------------------------------------------------------------------

# Landmark Stability

Some landmarks are naturally noisy.

Examples

Finger tips

Thumb tip

Little finger tip

These should receive stronger smoothing than

Shoulder

Chest

Hip

Different body parts require different smoothing levels.

-------------------------------------------------------------------------------

# Palm Orientation

Never estimate palm orientation from one landmark.

Instead

Compute a palm plane using multiple landmarks.

Recommended:

Wrist

Index MCP

Pinky MCP

This produces a stable palm normal.

-------------------------------------------------------------------------------

# Finger Direction

Finger direction should be calculated using the finger chain.

Example

Index MCP

↓

Index PIP

↓

Index DIP

↓

Index Tip

Each segment provides useful information.

Never estimate finger direction from the fingertip alone.

-------------------------------------------------------------------------------

# Coordinate Normalization

Never permanently normalize the JSON.

Normalize only during processing.

Reasons

Different signers

Different camera distance

Different body sizes

Normalization should happen inside the retargeter.

-------------------------------------------------------------------------------

# Landmark Filtering

Before retargeting

Run filters

Remove spikes

Remove impossible jumps

Clamp velocities

Smooth jitter

The goal is preserving motion while removing noise.

-------------------------------------------------------------------------------

# Sequence Consistency

The Avatar Engine should verify:

Did the signer teleport?

Did the wrist jump 40 cm in one frame?

Did fingers suddenly rotate backwards?

If yes

Flag the sequence.

Do not silently animate corrupted data.

-------------------------------------------------------------------------------

# Debug Viewer Requirements

Build a landmark viewer.

Features

Play

Pause

Frame slider

Current frame

Coordinates

Confidence

Missing landmark highlight

Left/right toggle

This viewer becomes the first debugging tool.

-------------------------------------------------------------------------------

# Logging

Every loaded clip should produce logs.

Example

Loading clip...

PASS

Frames

52

Left hand detected

51

Right hand detected

52

Confidence

0.94

Validation

PASS

This information should always be visible.

-------------------------------------------------------------------------------

# Unit Tests

Test

Missing frame

PASS

--------------------

One missing hand

PASS

--------------------

NaN coordinate

PASS

--------------------

Confidence below threshold

PASS

--------------------

Hand swap

PASS

--------------------

Sequence length mismatch

PASS

-------------------------------------------------------------------------------

# Acceptance Criteria

Chapter 4 is complete when

✓ Any landmark JSON loads

✓ Invalid sequences are rejected

✓ Missing hands handled

✓ Viewer operational

✓ Debug logs visible

✓ Filtering works

✓ Interpolation works

✓ Validation passes

Only then may the project continue to retargeting.

-------------------------------------------------------------------------------

# Claude Instructions

Do NOT animate yet.

Do NOT calculate bone rotations.

Do NOT guess missing data.

The purpose of this chapter is building a robust data ingestion pipeline.

The avatar engine should trust its input because it has already validated it.

Future chapters will convert these landmarks into animation.

-------------------------------------------------------------------------------

END OF CHAPTER 4
# =============================================================================
#
# CHAPTER 5
#
# RETARGETING ENGINE
#
# LANDMARKS → SKELETON
#
# =============================================================================

# Purpose

The purpose of the Retargeting Engine is to convert MediaPipe landmark
positions into anatomically correct bone rotations for a Ready Player Me
avatar.

This chapter is the mathematical heart of the Avatar Engine.

Nothing in this chapter should depend on React, Three.js UI, TensorFlow,
or game logic.

The Retargeting Engine should be completely reusable.

If another game wanted to animate a Ready Player Me avatar from MediaPipe
landmarks, they should be able to reuse this engine without modification.

-------------------------------------------------------------------------------

# Philosophy

MediaPipe provides POSITIONS.

The avatar requires ROTATIONS.

These are fundamentally different data types.

A point in space does not tell a bone how to rotate.

The Retargeting Engine bridges this gap.

The output of this chapter should be stable bone rotations.

Never directly copy landmark positions onto bones.

-------------------------------------------------------------------------------

# Pipeline

Landmark JSON

↓

Validation

↓

Normalization

↓

Direction Vectors

↓

Bone Rotations

↓

Calibration Offsets

↓

Quaternion Smoothing

↓

Animation Frames

Each stage should exist as an independent module.

-------------------------------------------------------------------------------

# Module Layout

retarget/

    LandmarkLoader.ts

    VectorBuilder.ts

    RotationSolver.ts

    QuaternionSolver.ts

    CalibrationApplier.ts

    MotionSmoother.ts

    AnimationBuilder.ts

Each module must perform only one task.

-------------------------------------------------------------------------------

# Stage 1
#
# Coordinate Normalization

MediaPipe coordinates exist in normalized camera space.

Avatar bones exist in local skeleton space.

The first responsibility is bringing both systems into a common frame of
reference.

Never rotate bones using raw landmark coordinates.

Instead

Convert

↓

Normalize

↓

Transform

↓

Rotate

-------------------------------------------------------------------------------

# Stage 2
#
# Direction Vector Construction

A bone should never rotate toward a landmark.

Instead

Construct a direction vector.

Example

Upper Arm

LEFT_SHOULDER

↓

LEFT_ELBOW

Direction

normalize(

LEFT_ELBOW

-

LEFT_SHOULDER

)

This direction represents how the upper arm points.

The same method applies to:

Forearm

Shoulder

Finger Segments

Thumb

-------------------------------------------------------------------------------

# Stage 3
#
# Bone Rotation

Every avatar bone has

Rest Direction

The landmark provides

Target Direction

The goal

Find the quaternion that rotates

Rest Direction

↓

Target Direction

Never compute rotations from positions directly.

-------------------------------------------------------------------------------

# Stage 4
#
# Calibration

Raw rotations are never applied directly.

Every rotation must pass through

Calibration

Reasons

Different avatars

Different bone rolls

Different rest poses

Different wrist alignment

Every avatar receives its own calibration profile.

-------------------------------------------------------------------------------

# Stage 5
#
# Quaternion Solver

Never animate using Euler angles.

Reasons

Gimbal Lock

Interpolation problems

Axis flipping

Instead

Store

Quaternion

Every animation frame should be represented internally using quaternions.

Only convert to Euler for debugging.

-------------------------------------------------------------------------------

# Stage 6
#
# Motion Smoothing

MediaPipe contains jitter.

Never pass raw rotations directly into animation.

Recommended pipeline

Quaternion

↓

SLERP

↓

Velocity Clamp

↓

Angular Clamp

↓

Animation

The objective

Smooth motion

without

Destroying sign meaning.

-------------------------------------------------------------------------------

# Stage 7
#
# Animation Frame Generation

Every processed frame should contain

Timestamp

Bone Rotations

Metadata

Confidence

Frame Index

Nothing more.

The Retargeting Engine should not know anything about
AnimationClips yet.

-------------------------------------------------------------------------------

# Direction Vector Rules

Always compute vectors from parent to child.

Correct

Shoulder

↓

Elbow

↓

Wrist

Incorrect

Shoulder

↓

Wrist

The shortest path is not always anatomically correct.

-------------------------------------------------------------------------------

# Wrist Rules

The wrist controls the hand.

Never rotate fingers before the wrist.

Pipeline

Arm

↓

Forearm

↓

Wrist

↓

Palm

↓

Fingers

Breaking this order causes unrealistic hand motion.

-------------------------------------------------------------------------------

# Finger Rules

Every finger is solved independently.

Thumb

Index

Middle

Ring

Pinky

Each finger has its own chain.

Never reuse one finger's solution for another.

-------------------------------------------------------------------------------

# Thumb Rules

The thumb is unique.

It has

Different axis

Different range of motion

Different orientation

The thumb requires a dedicated solver.

Never treat it as a normal finger.

-------------------------------------------------------------------------------

# Palm Orientation

Palm orientation should be determined before finger rotations.

Recommended landmarks

Wrist

Index MCP

Pinky MCP

Construct the palm plane.

Compute the palm normal.

Use this as the reference orientation for finger solving.

-------------------------------------------------------------------------------

# Rotation Limits

Human joints have limits.

Never allow

360°

rotation

Clamp all rotations.

Examples

Finger joints

0°–90°

Elbow

approximately 0°–150°

Wrist

physiological limits

These values should be configurable.

-------------------------------------------------------------------------------

# Confidence Handling

If confidence falls below threshold

Do NOT snap to origin.

Instead

Keep previous valid rotation

or

Blend smoothly

Never produce visible popping.

-------------------------------------------------------------------------------

# Debug Visualizer

Display

Green

Landmark direction

Blue

Avatar direction

Red

Error vector

Also display

Angular difference

per bone.

-------------------------------------------------------------------------------

# Logging

Example

Loading frame...

PASS

UpperArm

PASS

Forearm

PASS

Hand

PASS

Thumb

PASS

Animation frame generated

PASS

Every stage should produce meaningful logs.

-------------------------------------------------------------------------------

# Performance Goals

Target

60 FPS

The retargeting engine should process frames faster than real time.

Avoid unnecessary allocations.

Reuse vector objects when possible.

Keep garbage collection minimal.

-------------------------------------------------------------------------------

# Common Failure Cases

Problem

Arms twist 180°

Cause

Wrong rest direction

----------------------------

Problem

Hands backwards

Cause

Mirrored coordinate system

----------------------------

Problem

Spaghetti fingers

Cause

No calibration

----------------------------

Problem

Thumb behind palm

Cause

Using finger algorithm for thumb

----------------------------

Problem

Animation shakes

Cause

No smoothing

----------------------------

Problem

Random flips

Cause

Euler interpolation

-------------------------------------------------------------------------------

# Unit Tests

Upper arm vector

PASS

-------------------

Forearm vector

PASS

-------------------

Quaternion generation

PASS

-------------------

Calibration applied

PASS

-------------------

Motion smoothing

PASS

-------------------

Animation frame generated

PASS

-------------------------------------------------------------------------------

# Acceptance Criteria

This chapter is complete only when

✓ Every landmark chain generates a direction vector

✓ Every direction vector generates a quaternion

✓ Calibration offsets are applied

✓ Motion is smoothed

✓ No Euler interpolation is used internally

✓ Rotations remain anatomically believable

✓ Every stage is independently testable

No fingers should explode.

No wrists should flip.

No frame should produce invalid quaternions.

-------------------------------------------------------------------------------

# Research Notes

Why not rotate bones directly toward landmarks?

Because landmarks are positions, while bones require orientations.

Professional animation systems first derive direction vectors, then compute
rotations relative to the avatar's rest pose.

This is the same principle used in motion capture retargeting pipelines.

-------------------------------------------------------------------------------

# Claude Instructions

DO NOT proceed to finger optimization.

DO NOT add pose libraries yet.

DO NOT export animations.

Focus exclusively on producing mathematically correct bone rotations.

Only after the retargeting engine consistently generates stable rotations
should later chapters introduce animation baking, blending, and optimization.

-------------------------------------------------------------------------------

END OF CHAPTER 5# =============================================================================
#
# CHAPTER 6
#
# FINGER SOLVER ENGINE
#
# =============================================================================

# WARNING

This is the most difficult subsystem in the Avatar Engine.

Do not rush this chapter.

Do not skip steps.

Do not try to "eyeball" finger rotations.

Incorrect finger animation immediately makes sign language unreadable.

Unlike body animation, fingers carry the majority of linguistic information in
American Sign Language.

Therefore accuracy is significantly more important than smoothness.

-------------------------------------------------------------------------------

# Goal

Convert MediaPipe finger landmarks into stable,
anatomically correct finger rotations.

The solver should work on any Ready Player Me avatar after calibration.

It should NOT be hardcoded to one avatar.

-------------------------------------------------------------------------------

# Why Fingers Are Difficult

Unlike arms and legs, fingers:

• have extremely small movements

• contain noisy landmarks

• frequently self-occlude

• rotate around different local axes

• have unique thumb mechanics

• vary between avatars

Therefore a dedicated solver is required.

-------------------------------------------------------------------------------

# Finger Anatomy

Every finger consists of joints.

Index

MCP

↓

PIP

↓

DIP

↓

TIP

Middle

MCP

↓

PIP

↓

DIP

↓

TIP

Ring

↓

...

Pinky

↓

...

Thumb

CMC

↓

MCP

↓

IP

↓

TIP

Notice:

The thumb DOES NOT share the same anatomy.

Treat it separately.

-------------------------------------------------------------------------------

# Input

Each frame contains

21 MediaPipe landmarks per hand.

These represent POSITIONS.

Not rotations.

The solver must derive rotations mathematically.

-------------------------------------------------------------------------------

# Pipeline

MediaPipe Landmarks

↓

Palm Orientation

↓

Finger Chains

↓

Direction Vectors

↓

Joint Angles

↓

Quaternion Solver

↓

Calibration

↓

Motion Filter

↓

Bone Rotations

-------------------------------------------------------------------------------

# Stage 1
#
# Palm Orientation

Before solving fingers,

solve the palm.

Recommended landmarks

WRIST

INDEX_MCP

PINKY_MCP

Construct a plane.

Compute the normal.

Store palm orientation.

Every finger will use this coordinate frame.

-------------------------------------------------------------------------------

# Stage 2
#
# Finger Chains

Build chains.

Example

Index

MCP

↓

PIP

↓

DIP

↓

TIP

Each chain is solved independently.

Never combine fingers.

-------------------------------------------------------------------------------

# Stage 3
#
# Direction Vectors

For every segment

Compute

child

-

parent

Normalize.

Store.

Example

Index MCP

↓

Index PIP

↓

Vector A

Index PIP

↓

Index DIP

↓

Vector B

Index DIP

↓

Index TIP

↓

Vector C

-------------------------------------------------------------------------------

# Stage 4
#
# Joint Angles

Calculate

Angle(VectorA, VectorB)

Store

Flexion

Extension

These become the driving parameters.

Never estimate angles visually.

-------------------------------------------------------------------------------

# Stage 5
#
# Quaternion Generation

Convert

Joint Angles

↓

Bone Quaternion

Never interpolate using Euler angles.

Use Quaternion SLERP.

-------------------------------------------------------------------------------

# Stage 6
#
# Calibration

Every quaternion passes through

Calibration.

Reasons

Bone roll

Avatar proportions

Axis corrections

Thumb orientation

Never bypass calibration.

-------------------------------------------------------------------------------

# Stage 7
#
# Motion Filtering

Finger landmarks jitter.

Apply

Low-pass filter

↓

Velocity clamp

↓

Angular smoothing

↓

Quaternion SLERP

Goal

Reduce noise

without destroying linguistic meaning.

-------------------------------------------------------------------------------

# Thumb Solver

The thumb deserves its own module.

thumbSolver.ts

Reasons

Thumb rotates around different axes.

Thumb opposes the palm.

Thumb has different range of motion.

Thumb calibration differs.

Never reuse index finger logic.

-------------------------------------------------------------------------------

# Rotation Limits

Every joint has limits.

MCP

Configurable

PIP

Configurable

DIP

Configurable

Thumb

Separate configuration

Never rotate beyond anatomical limits.

-------------------------------------------------------------------------------

# Curl Estimation

Calculate curl

Extended

Half Curled

Curled

Fully Closed

Store

0.0

↓

1.0

Curl becomes useful later for

Pose blending

Recognition debugging

Animation compression

-------------------------------------------------------------------------------

# Finger Spread

Finger spread should be computed separately.

Example

Distance between

Index

Middle

Ring

Pinky

Spread influences handshape.

Curl alone is insufficient.

-------------------------------------------------------------------------------

# Confidence

Low confidence

↓

Do not snap

↓

Hold previous pose

↓

Blend when confidence returns

-------------------------------------------------------------------------------

# Failure Recovery

If

TIP disappears

Continue using

PIP

If

Entire finger disappears

Freeze previous pose.

Never explode.

-------------------------------------------------------------------------------

# Performance

Solver must support

Real-time

60 FPS

Avoid allocating vectors every frame.

Reuse temporary objects.

-------------------------------------------------------------------------------

# Debug Viewer

The viewer must support

Show palm normal

Show finger vectors

Show curl values

Show spread values

Highlight invalid joints

Toggle individual fingers

Display quaternion values

Freeze frame

Step frame

Export screenshot

-------------------------------------------------------------------------------

# Required Modules

fingerSolver.ts

thumbSolver.ts

curlEstimator.ts

spreadEstimator.ts

jointLimits.ts

fingerDebugger.ts

-------------------------------------------------------------------------------

# Logging

Frame 82

Palm

PASS

Thumb

PASS

Index

PASS

Middle

PASS

Ring

PASS

Pinky

PASS

Quaternion

PASS

-------------------------------------------------------------------------------

# Unit Tests

Palm orientation

PASS

---------------------

Index chain

PASS

---------------------

Thumb chain

PASS

---------------------

Quaternion output

PASS

---------------------

Joint limits

PASS

---------------------

Missing fingertip

PASS

---------------------

Noise filtering

PASS

-------------------------------------------------------------------------------

# Common Failure Cases

Problem

Spaghetti fingers

Cause

Wrong local axis

--------------------------------

Problem

Thumb backwards

Cause

Using finger algorithm

--------------------------------

Problem

Fingers vibrate

Cause

No filtering

--------------------------------

Problem

Finger twists 180°

Cause

Euler interpolation

--------------------------------

Problem

Handshape unreadable

Cause

Ignoring spread

--------------------------------

Problem

Bent backwards

Cause

Missing joint limits

-------------------------------------------------------------------------------

# Acceptance Criteria

Chapter complete only if

✓ Palm orientation stable

✓ Every finger solved independently

✓ Thumb solved separately

✓ Joint limits enforced

✓ Curl values generated

✓ Spread values generated

✓ No exploding fingers

✓ No impossible bends

✓ Stable animation at 60 FPS

-------------------------------------------------------------------------------

# Research Notes

Professional motion capture systems rarely drive fingers directly from raw
landmark positions.

Instead they derive higher-level parameters such as

• curl

• spread

• palm orientation

• joint flexion

Those parameters are then converted into calibrated bone rotations.

This approach is significantly more robust across different avatar skeletons.

-------------------------------------------------------------------------------

# Claude Instructions

Never continue to animation export until

1.

All five fingers behave correctly.

2.

Thumb behaves correctly.

3.

Palm orientation remains stable.

4.

Joint limits are respected.

5.

Finger solver passes every test.

Finger animation quality determines whether ASL is readable.

Treat this chapter as the highest priority of the entire project.

-------------------------------------------------------------------------------

END OF CHAPTER 6
# =============================================================================
#
# CHAPTER 7
#
# CALIBRATION ENGINE
#
# "WHY YOUR AVATAR DOESN'T MATCH MEDIAPIPE"
#
# =============================================================================

# WARNING

DO NOT SKIP THIS CHAPTER.

Most avatar animation projects fail because they assume the avatar skeleton
matches MediaPipe.

It does not.

This chapter exists to solve that problem.

Calibration is NOT optional.

Calibration is the foundation of every future animation.

If calibration is wrong,

every animation,

every finger,

every wrist,

every exported clip

will also be wrong.

-------------------------------------------------------------------------------

# Purpose

Convert an arbitrary humanoid avatar into a calibrated avatar that can be
driven from MediaPipe landmarks.

Calibration is performed ONCE.

Animation happens thousands of times.

Therefore calibration should solve as many problems as possible.

-------------------------------------------------------------------------------

# Philosophy

Never modify MediaPipe.

Never modify landmark JSON.

Instead

modify the avatar's understanding of itself.

Think of calibration as teaching the avatar where its bones really are.

-------------------------------------------------------------------------------

# High Level Pipeline

Ready Player Me Avatar

↓

Skeleton Analysis

↓

Calibration Wizard

↓

Bone Offsets

↓

Axis Corrections

↓

Calibration Profile

↓

Animation Engine

-------------------------------------------------------------------------------

# Why Calibration Exists

MediaPipe assumes

Human anatomy.

Your avatar contains

Computer graphics bones.

These rarely match.

Examples

Bone rolls differ.

Bone lengths differ.

Rest poses differ.

Local axes differ.

Finger orientations differ.

Thumbs differ.

Calibration removes these differences.

-------------------------------------------------------------------------------

# Calibration Profile

Each avatar receives

calibration.json

This file contains

Avatar Version

Bone Names

Bone Lengths

Rest Pose

Axis Corrections

Roll Corrections

Scale

Hand Offsets

Finger Offsets

Thumb Offsets

Date

Generator Version

Never edit manually.

Always regenerate.

-------------------------------------------------------------------------------

# Stage 1
#
# Bone Mapping

Map MediaPipe concepts

↓

Avatar bones

Example

LEFT_SHOULDER

↓

LeftUpperArm

RIGHT_WRIST

↓

RightHand

INDEX_MCP

↓

LeftIndexProximal

etc.

Never hardcode names.

Search intelligently.

-------------------------------------------------------------------------------

# Stage 2
#
# Rest Pose Capture

Capture the avatar before animation.

Store

Position

Quaternion

Matrix

Scale

This becomes

RestPose.json

Never overwrite.

-------------------------------------------------------------------------------

# Stage 3
#
# Bone Length Analysis

Measure every bone.

Distance

Parent

↓

Child

Store

boneLength

Used later for debugging and IK.

-------------------------------------------------------------------------------

# Stage 4
#
# Local Axis Detection

For every bone

Determine

Forward

Up

Right

Display them visually.

Never assume X,Y,Z meanings.

-------------------------------------------------------------------------------

# Stage 5
#
# Bone Roll Detection

Bone roll causes

twisted fingers

rotated wrists

flipped elbows

Calculate

rollOffset

for every movable bone.

Store permanently.

-------------------------------------------------------------------------------

# Stage 6
#
# Wrist Calibration

The wrist controls the hand.

Calculate

Hand Rotation Offset

Palm Offset

Finger Root Offset

Every finger depends on this.

-------------------------------------------------------------------------------

# Stage 7
#
# Thumb Calibration

Thumbs vary dramatically.

Calibrate

Thumb Base

Thumb Axis

Thumb Twist

Thumb Curl Direction

Never reuse finger calibration.

-------------------------------------------------------------------------------

# Stage 8
#
# Validation

Reset avatar.

Apply calibration.

The avatar should look identical.

If appearance changes,

calibration is incorrect.

-------------------------------------------------------------------------------

# Calibration Viewer

Build

CalibrationViewer

Features

Show skeleton

Show local axes

Toggle rest pose

Toggle calibrated pose

Display offsets

Highlight selected bone

Live update values

Save calibration

Reset calibration

-------------------------------------------------------------------------------

# Manual Override

Although calibration should be automatic,

support manual correction.

Example

Rotate wrist offset

+2°

Save

Re-test

This is invaluable during debugging.

-------------------------------------------------------------------------------

# Versioning

Every calibration profile should include

Avatar Hash

Generator Version

Date

Git Commit

This ensures old animations can be traced back to the exact calibration.

-------------------------------------------------------------------------------

# Logging

Example

Loading avatar...

PASS

Analyzing skeleton...

PASS

Bone rolls...

PASS

Axis detection...

PASS

Calibration saved...

PASS

-------------------------------------------------------------------------------

# Failure Cases

Problem

Hands rotated 90°

Cause

Wrong wrist offset

-----------------------------------

Problem

Finger bends sideways

Cause

Wrong local axis

-----------------------------------

Problem

Avatar shrugs constantly

Cause

Incorrect shoulder calibration

-----------------------------------

Problem

Thumb inside palm

Cause

Thumb offset missing

-------------------------------------------------------------------------------

# Tests

Bone mapping

PASS

----------------------

Axis detection

PASS

----------------------

Roll detection

PASS

----------------------

Rest pose

PASS

----------------------

Calibration export

PASS

----------------------

Reload calibration

PASS

-------------------------------------------------------------------------------

# Acceptance Criteria

Calibration is complete only if

✓ Every movable bone mapped

✓ Rest pose stored

✓ Local axes detected

✓ Bone rolls corrected

✓ Wrist calibrated

✓ Thumb calibrated

✓ Calibration reloads correctly

✓ Avatar appearance unchanged after calibration

-------------------------------------------------------------------------------

# Engineering Rule

Calibration is generated once.

Animation uses it forever.

Never recompute calibration every frame.

-------------------------------------------------------------------------------

# Research Notes

Professional motion capture systems (Autodesk MotionBuilder, Rokoko Studio,
and commercial retargeting tools) always separate calibration from playback.

This dramatically improves stability and portability.

Follow the same principle.

-------------------------------------------------------------------------------

# Claude Instructions

Do not animate.

Do not interpolate.

Do not export.

Focus entirely on building a robust calibration system that can support
future avatars without modification.

Only after calibration is mathematically correct should animation begin.

-------------------------------------------------------------------------------

END OF CHAPTER 7# =============================================================================
#
# CHAPTER 8
#
# ANIMATION VERIFICATION ENGINE
#
# "DON'T TRUST YOUR EYES"
#
# =============================================================================

# WARNING

Never assume an animation is correct because it "looks okay."

Human eyes are poor at detecting small errors in:

• Finger curl
• Wrist twist
• Thumb orientation
• Palm rotation
• Timing
• Bone drift

The Avatar Engine must verify animation mathematically.

If the animation cannot be verified,
it cannot be considered production ready.

-------------------------------------------------------------------------------

# Philosophy

Every generated animation should be treated as testable data.

The Avatar Engine should never rely on visual inspection alone.

Every animation should produce a quality report.

Think of animation as software.

Software has tests.

Animations should too.

-------------------------------------------------------------------------------

# Goal

Compare

MediaPipe

↓

Generated Animation

↓

Measure Error

↓

Produce Report

-------------------------------------------------------------------------------

# Verification Pipeline

Landmark JSON

↓

Retargeting Engine

↓

Avatar Animation

↓

Sample Avatar Bones

↓

Compare

↓

Generate Report

-------------------------------------------------------------------------------

# Why Verification Matters

Suppose the avatar signs

HELLO

The movement looks correct.

But

Index finger

is rotated

18°

incorrectly.

Humans may not notice.

Later

THANK YOU

inherits that error.

Later

COFFEE

inherits that error.

Eventually

every sign becomes slightly wrong.

Verification catches these problems immediately.

-------------------------------------------------------------------------------

# Measurements

The engine should compute

Bone Rotation Error

Position Error

Angular Error

Palm Error

Finger Curl Error

Finger Spread Error

Timing Error

Frame Drift

Confidence Score

These values should be displayed numerically.

-------------------------------------------------------------------------------

# Bone Rotation Error

For every animated bone

Compare

Expected Direction

↓

Actual Direction

Compute

Angle Difference

Store

Degrees

Example

LeftIndex2

Expected

35°

Actual

39°

Error

4°

-------------------------------------------------------------------------------

# Position Error

Measure

Expected Joint Position

↓

Avatar Joint Position

Store

Distance

Example

Expected Wrist

(0.45,0.18)

Actual Wrist

(0.44,0.19)

Error

0.012m

-------------------------------------------------------------------------------

# Palm Verification

Palm orientation should be compared separately.

Measure

Normal Vector

Expected

↓

Actual

Display

Angular Difference

-------------------------------------------------------------------------------

# Curl Verification

Compare

Expected Curl

↓

Avatar Curl

Store

Error

Every finger receives a curl score.

-------------------------------------------------------------------------------

# Spread Verification

Compare

Expected Finger Spread

↓

Avatar Spread

Store

Difference

-------------------------------------------------------------------------------

# Timing Verification

Animation should preserve timing.

Measure

Frame

↓

Timestamp

↓

Playback

Detect

Dropped Frames

Repeated Frames

Skipped Frames

-------------------------------------------------------------------------------

# Drift Detection

Long animations sometimes drift.

Measure

Frame 0

↓

Frame N

Compare

Shoulder

Hip

Chest

If drift exceeds threshold,

report failure.

-------------------------------------------------------------------------------

# Error Heatmap

Viewer should color bones.

Green

Small error

Yellow

Moderate error

Orange

High error

Red

Critical error

This allows instant diagnosis.

-------------------------------------------------------------------------------

# Quality Score

Every animation should receive

Overall Score

Example

Overall

96%

Arms

98%

Hands

94%

Thumb

90%

Timing

100%

This score becomes the benchmark.

-------------------------------------------------------------------------------

# Verification Viewer

Split Screen

LEFT

MediaPipe Skeleton

RIGHT

Avatar

Bottom Panel

Current Frame

Angular Error

Position Error

Palm Error

FPS

Quaternion

Confidence

Quality Score

-------------------------------------------------------------------------------

# Logging

Verification Started...

PASS

Bone Errors...

PASS

Timing...

PASS

Drift...

PASS

Report Generated...

PASS

-------------------------------------------------------------------------------

# Reports

Every animation should generate

verification_report.json

Contains

Animation Name

Date

Avatar Version

Calibration Version

Average Error

Maximum Error

Worst Bone

Quality Score

Warnings

-------------------------------------------------------------------------------

# Thresholds

Suggested Defaults

Angular Error

< 5°

Excellent

5–10°

Acceptable

10–20°

Needs Review

>20°

Fail

These values should be configurable.

-------------------------------------------------------------------------------

# Automatic Failure

The verifier should fail if

Any quaternion is invalid

Bone contains NaN

Bone flips

Finger exceeds joint limits

Palm rotates backwards

Animation contains missing frames

Verification should stop export.

-------------------------------------------------------------------------------

# Continuous Integration

Whenever animation code changes

Automatically

Run Verification

Generate Report

Compare against previous version

If quality decreases,

fail the build.

Animation quality should never silently regress.

-------------------------------------------------------------------------------

# Unit Tests

Bone Error

PASS

----------------------

Palm Error

PASS

----------------------

Curl Error

PASS

----------------------

Spread Error

PASS

----------------------

Timing

PASS

----------------------

Report Export

PASS

-------------------------------------------------------------------------------

# Acceptance Criteria

Chapter complete only if

✓ Every animation generates a report

✓ Every bone receives an error value

✓ Heatmap works

✓ Verification report saved

✓ Quality score generated

✓ Thresholds configurable

✓ Export blocked on critical failures

-------------------------------------------------------------------------------

# Engineering Principle

Never trust appearance.

Trust measurements.

A mathematically verified animation is far more reliable than one that merely
"looks correct."

-------------------------------------------------------------------------------

# Claude Instructions

Do not optimize animation before verification exists.

Build the verifier first.

Future improvements should always be measured against objective metrics.

-------------------------------------------------------------------------------

END OF CHAPTER 8# =============================================================================
#
# FINAL CHAPTER
#
# ENGINEERING PRINCIPLES
#
# THE CONSTITUTION OF THE AVATAR ENGINE
#
# =============================================================================

# Purpose

This chapter defines the permanent engineering principles that govern the
Avatar Engine.

Unlike implementation details, these principles should remain stable even if
the codebase changes.

Whenever a technical decision is uncertain, these principles take precedence.

The goal is to ensure that every future engineer, every AI assistant, and
every contributor builds the system consistently.

-------------------------------------------------------------------------------

# Principle 1
#
# Single Responsibility

Every module must have one clearly defined purpose.

Good

LandmarkLoader

↓

Loads landmarks

Bad

LandmarkLoader

↓

Loads landmarks

↓

Animates avatar

↓

Exports GLB

↓

Runs UI

If a module performs multiple unrelated tasks,
split it.

-------------------------------------------------------------------------------

# Principle 2
#
# Data Is Sacred

Original landmark JSON files are the source of truth.

Never edit them.

Never overwrite them.

Never normalize them permanently.

All transformations occur in memory.

If landmark generation changes,
regenerate the dataset rather than patching files manually.

-------------------------------------------------------------------------------

# Principle 3
#
# Calibration Before Animation

No animation should be generated until calibration is complete.

Incorrect calibration causes:

• twisted wrists

• flipped elbows

• spaghetti fingers

• unstable thumbs

Every animation depends on calibration.

Calibration happens once.

Animation happens forever.

-------------------------------------------------------------------------------

# Principle 4
#
# Visualization Before Optimization

Never optimize code you cannot see.

If behavior is unclear,
build a visualization tool first.

Examples

Bone axes

Palm normals

Finger curl

Error vectors

Heatmaps

Debugging visually is often faster than guessing mathematically.

-------------------------------------------------------------------------------

# Principle 5
#
# Measure Before Changing

Every modification must be measurable.

Never accept changes because they "look better."

Instead compare:

Angular Error

Position Error

Quality Score

Verification Report

Regression Tests

Improvements must be backed by objective evidence.

-------------------------------------------------------------------------------

# Principle 6
#
# Fail Loudly

Never silently ignore problems.

Examples

Missing landmarks

↓

Display warning

Invalid quaternion

↓

Stop processing

Calibration missing

↓

Abort

Corrupt animation

↓

Reject export

Hidden failures become expensive bugs.

-------------------------------------------------------------------------------

# Principle 7
#
# Preserve Existing Functionality

Never improve one sign by breaking another.

Every modification must pass:

HELLO

THANK_YOU

PLEASE

COFFEE

YES

NO

and every future benchmark sign.

Regression testing is mandatory.

-------------------------------------------------------------------------------

# Principle 8
#
# Build Small Systems

Large systems are difficult to debug.

Instead

Landmark Loader

↓

Validator

↓

Feature Extractor

↓

Retargeter

↓

Quaternion Solver

↓

Animation Builder

↓

Verifier

↓

Exporter

Each module should be independently testable.

-------------------------------------------------------------------------------

# Principle 9
#
# Build Debug Tools First

If debugging requires editing code,
the debugging tools are insufficient.

Every subsystem should have:

Viewer

Inspector

Report Generator

Logs

Frame Scrubber

Visualization

Engineers should debug using tools,
not print statements.

-------------------------------------------------------------------------------

# Principle 10
#
# Never Guess

Whenever uncertainty exists:

Measure.

Visualize.

Log.

Verify.

Only then modify algorithms.

Never introduce "magic numbers" without documentation.

-------------------------------------------------------------------------------

# Principle 11
#
# Every Decision Must Be Documented

If an algorithm requires:

Coordinate convention

Bone assumption

Quaternion order

Calibration offset

Rotation limit

Document it.

Future engineers should understand WHY a decision exists.

-------------------------------------------------------------------------------

# Principle 12
#
# Version Everything

Every important artifact should contain version information.

Examples

Calibration

Animation

Avatar

Exporter

Verification Report

This allows reproducibility.

-------------------------------------------------------------------------------

# Principle 13
#
# Automation Over Manual Work

Anything repeated more than twice should become a tool.

Examples

Calibration

Verification

Benchmarking

Regression Testing

Animation Reports

Screenshots

Logs

Automation reduces human error.

-------------------------------------------------------------------------------

# Principle 14
#
# Build for Scale

The engine should never assume:

One avatar

One signer

One language

One dataset

One camera

The architecture should support future expansion.

-------------------------------------------------------------------------------

# Principle 15
#
# Performance Is a Feature

Target

60 FPS

Avoid unnecessary allocations.

Reuse objects.

Profile before optimizing.

Correctness first.

Performance second.

-------------------------------------------------------------------------------

# Principle 16
#
# Human Readability Matters

Code is written once.

Read hundreds of times.

Prefer

Clear

Modular

Documented

Predictable

over

Short

Clever

Complicated

-------------------------------------------------------------------------------

# Principle 17
#
# Testing Is Not Optional

Every module must include:

Unit Tests

Integration Tests

Visualization

Verification

Benchmarks

Passing tests are required before merging.

-------------------------------------------------------------------------------

# Principle 18
#
# AvatarLab Is The Development Environment

All avatar development should happen inside AvatarLab.

AvatarLab contains:

Skeleton Inspector

Landmark Inspector

Calibration Studio

Retarget Viewer

Finger Debugger

Animation Verifier

Benchmark Runner

Regression Tester

Do not debug inside the game.

Debug inside AvatarLab.

-------------------------------------------------------------------------------

# Principle 19
#
# AI Is An Assistant, Not An Authority

Claude should assist engineering.

Claude should not replace engineering judgment.

Whenever Claude proposes an algorithm:

Verify it.

Measure it.

Benchmark it.

Then accept or reject it.

-------------------------------------------------------------------------------

# Principle 20
#
# Definition of Engineering Success

The project succeeds only when:

✓ The avatar signs accurately.

✓ Animations are mathematically verified.

✓ Regression tests remain green.

✓ New signs require no architectural changes.

✓ The engine is reusable.

✓ Documentation remains current.

✓ Another engineer can understand the project without asking questions.

-------------------------------------------------------------------------------

# The Long-Term Vision

The Avatar Engine is not just a feature.

It is a reusable platform.

Future applications may include:

• American Sign Language education

• British Sign Language

• Virtual teachers

• Educational games

• NPC sign language

• VR communication

• Accessibility tools

• Motion capture research

• Robotics

Design every subsystem with that future in mind.

-------------------------------------------------------------------------------

# Final Instructions To Claude

You are not building a prototype.

You are building an engineering platform.

Every decision should prioritize:

Correctness

Maintainability

Scalability

Observability

Reusability

If there is a conflict between speed and quality,

choose quality.

The code you write today should still be understandable and useful years from now.

-------------------------------------------------------------------------------

END OF DOCUMENTAppendix A — Engineering Constraints and Non-Negotiable Rules
1. MediaPipe is NOT Motion Capture

MediaPipe landmarks are estimated, not ground-truth motion capture.

The system must never assume that all six degrees of freedom of every bone can be perfectly reconstructed from landmark positions.

Important implications:

X/Y coordinates are generally reliable.
Z (depth) is estimated and noisier.
Rotation around a bone's own axis (twist/roll) is partially unobservable from a single RGB camera.
Perfect reconstruction is impossible.

Success means:

Stable animation
Natural motion
Correct ASL handshape

NOT mathematically perfect recovery.

2. Never Invent Missing Information

If the landmark data cannot uniquely determine a rotation:

DO NOT:

invent random math
estimate arbitrary Euler angles
create fake roll values
force impossible reconstruction

Instead:

keep previous frame
use anatomical limits
interpolate smoothly
estimate conservatively

Stability is always preferred over guessing.

3. Observable vs Unobservable Motion

Claude must distinguish between:

Observable

Joint positions
Finger curl
Finger spread
Palm normal
Wrist position
Elbow position
Shoulder position

Unobservable

Forearm twist
Wrist roll
Bone-local roll
Hidden finger rotation

Unobservable rotations MUST be estimated using constraints, never assumed to be directly measurable.

4. Anatomical Constraints

When ambiguity exists:

Use anatomical constraints.

Examples:

Elbow only bends one primary axis.
Thumb cannot rotate 360°.
Fingers cannot hyperextend.
Wrist twist limited to realistic range.
Palm should remain anatomically plausible.

Natural motion is more important than exact reconstruction.

5. Use Quaternion Math

Never solve rotations using Euler angles.

Always use:

Quaternion.LookRotation
Quaternion.FromToRotation
Quaternion.Slerp

Only convert to Euler for debugging.

6. Temporal Consistency

Animation should never jitter because one frame is noisy.

Preferred order:

Previous frame continuity
Anatomical limits
Landmark measurement

Never sacrifice temporal stability to perfectly fit one noisy frame.

7. World Landmarks Preferred

Whenever possible:

Prefer

MediaPipe World Landmarks

instead of

Normalized Screen Landmarks

because world landmarks preserve better relative depth.

If unavailable:

Fall back gracefully.

8. Verification is NOT Linguistic Validation

The verification engine checks:

✓ math
✓ rotations
✓ constraints
✓ continuity

It does NOT verify:

linguistic correctness
ASL grammar
educational quality

Those require human validation.

Never claim the avatar signs correct ASL solely because verification passes.

9. Acceptance Tests Must Be Real

Whenever the document says:

PASS

that is illustrative only.

Claude must implement real assertions.

Good:

assert(angleError < 5°)

Bad:

print("PASS")

Every acceptance test must fail when requirements are violated.

10. Never Optimize for Passing Tests

Claude must not:

hardcode outputs
bypass calculations
fake values
return expected answers

Every result must come from actual computation.

11. Priorities

When multiple solutions exist:

Priority order:

Stable animation
Correct handshape
Correct finger curl
Smooth motion
Natural wrist orientation
Exact bone twist

Exact twist is the least important because it cannot be fully recovered.

12. Failure is Acceptable

If a rotation cannot be confidently determined:

The engine must report

LOW_CONFIDENCE

instead of inventing values.

Unknown is better than wrong.

13. Human Override

Every calibration result must remain editable.

No discovered calibration is considered absolute truth.

Humans must be able to override:

bone axes
offsets
twist correction
thumb calibration

without modifying source code.

14. No Magic Numbers

Every constant must have:

explanation
units
justification

Never use unexplained values like

0.73

or

17.2°

without documenting why.

15. Incremental Development

Never implement the entire system in one step.

Complete:

Milestone

↓

Verification

↓

Approval

↓

Next milestone

Do not skip verification.

⭐ One more thing I'd add

I would add a final rule called:

Engineering Philosophy

The objective of this project is not to perfectly reconstruct human motion. The objective is to produce visually stable, anatomically plausible, educationally useful ASL avatar animations from MediaPipe landmarks. When these goals conflict, prioritize stability, natural appearance, and correct handshape over mathematically exact reconstruction.