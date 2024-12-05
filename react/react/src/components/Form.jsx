import React from 'react'

const Form = ({ClearForm}) => {
  return (
    <div>
        <form className="content">
            <button onClick={clearForm}>clear</button>
            

        </form>
    </div>
  )
}

export default Form