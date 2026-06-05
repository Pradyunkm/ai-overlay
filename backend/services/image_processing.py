# Import OpenCV library
import cv2

# Import OS library
import os


# -----------------------------------------
# Function:
# Convert image to grayscale
# -----------------------------------------
def convert_to_grayscale(image_path):


    # Read image from path
    image = cv2.imread(image_path)


    # Convert image into grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


    # Output image path
    output_path = "outputs/grayscale.png"


    # Save grayscale image
    cv2.imwrite(output_path, gray)


    # Return saved image path
    return output_path