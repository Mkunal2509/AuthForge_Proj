from app.services.audio_preprocessing import preprocess_audio


input_file = r"C:/Users/Shraddha/Downloads/sample voice 2.mp3"

output_file = preprocess_audio(input_file)

print("Processed audio:")
print(output_file)